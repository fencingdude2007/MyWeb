// MyWeb AI popup: log in with email/password, then save the current tab.
const API_BASE = "http://localhost:8000";

// --- tiny helpers ---------------------------------------------------------
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getToken(): Promise<string | null> {
  const { token } = await chrome.storage.local.get("token");
  return token ?? null;
}

async function apiFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(API_BASE + path, { ...init, headers });
}

// --- view switching -------------------------------------------------------
function showAuth(message = "") {
  $("auth-view").classList.remove("hidden");
  $("save-view").classList.add("hidden");
  const status = $("auth-status");
  status.textContent = message;
  status.className = message ? "status err" : "status";
}

async function showSave() {
  $("auth-view").classList.add("hidden");
  $("save-view").classList.remove("hidden");
  $("summary").textContent = "";
  setStatus("");

  const tab = await activeTab();
  const titleEl = $("page-title");
  const saveBtn = $<HTMLButtonElement>("save-btn");
  if (tab?.url && /^https?:/.test(tab.url)) {
    titleEl.textContent = tab.title || tab.url;
    saveBtn.disabled = false;
  } else {
    titleEl.textContent = "This page can't be saved.";
    saveBtn.disabled = true;
  }
}

function setStatus(text: string, kind: "ok" | "err" | "muted" = "muted") {
  const el = $("save-status");
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Grab the current rendered HTML of the page (the "saved state").
async function capturePageHtml(tabId: number): Promise<string | null> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML,
    });
    return (injection?.result as string) ?? null;
  } catch {
    // Restricted pages (chrome://, web store, PDFs) can't be scripted.
    return null;
  }
}

// --- auth -----------------------------------------------------------------
async function authenticate(path: "/auth/login" | "/auth/register") {
  const email = $<HTMLInputElement>("email").value.trim();
  const password = $<HTMLInputElement>("password").value;
  if (!email || !password) return showAuth("Enter an email and password.");

  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).catch(() => null);

  if (!res) return showAuth("Can't reach the server — is the backend running?");
  if (!res.ok) {
    const fallback = path === "/auth/login" ? "Invalid email or password." : "Could not register.";
    const detail = await res.json().catch(() => ({}));
    return showAuth(detail.detail || fallback);
  }
  const { access_token } = await res.json();
  await chrome.storage.local.set({ token: access_token });
  await showSave();
}

// --- Google sign-in -------------------------------------------------------
async function signInWithGoogle() {
  // The backend runs the Google flow and redirects the tokens back to the
  // extension's own https://<id>.chromiumapp.org/ URL, which this captures.
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = `${API_BASE}/auth/google/login?ext_redirect=${encodeURIComponent(redirectUri)}`;
  try {
    const resultUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
    if (!resultUrl) return showAuth("Google sign-in was cancelled.");
    const params = new URLSearchParams(new URL(resultUrl).hash.slice(1));
    const token = params.get("access_token");
    if (!token) return showAuth("Google sign-in failed.");
    await chrome.storage.local.set({ token });
    await showSave();
  } catch {
    showAuth("Google sign-in failed or was cancelled.");
  }
}

// --- save + poll ----------------------------------------------------------
async function savePage() {
  const token = await getToken();
  if (!token) return showAuth();
  const tab = await activeTab();
  if (!tab?.url) return setStatus("No active page.", "err");

  $<HTMLButtonElement>("save-btn").disabled = true;
  setStatus("Capturing page…");

  const html = tab.id ? await capturePageHtml(tab.id) : null;
  setStatus("Saving…");

  const res = await apiFetch("/pages", {
    method: "POST",
    body: JSON.stringify({ url: tab.url, html }),
  }, token).catch(() => null);

  if (res && res.status === 401) {
    await chrome.storage.local.remove("token");
    return showAuth("Session expired — please log in again.");
  }
  if (!res || !res.ok) {
    setStatus("Save failed.", "err");
    $<HTMLButtonElement>("save-btn").disabled = false;
    return;
  }

  const page = await res.json();
  setStatus("Processing…");
  await pollUntilReady(page.id, token);
}

async function pollUntilReady(pageId: number, token: string) {
  for (let i = 0; i < 40; i++) {
    const res = await apiFetch(`/pages/${pageId}`, {}, token).catch(() => null);
    if (res?.ok) {
      const page = await res.json();
      if (page.status === "ready") {
        setStatus("✓ Saved", "ok");
        $("summary").textContent = page.summary || "";
        $<HTMLButtonElement>("save-btn").disabled = false;
        return;
      }
      if (page.status === "failed") {
        setStatus("Saved, but processing failed.", "err");
        $<HTMLButtonElement>("save-btn").disabled = false;
        return;
      }
    }
    await sleep(700);
  }
  setStatus("✓ Saved (still processing in the background)", "ok");
  $<HTMLButtonElement>("save-btn").disabled = false;
}

// --- bookmark import --------------------------------------------------------
const WEB_APP_URL = "http://localhost:5173";
const IMPORT_BATCH = 200; // matches the backend's per-request cap comfortably

function collectBookmarkUrls(nodes: chrome.bookmarks.BookmarkTreeNode[]): string[] {
  const urls: string[] = [];
  const walk = (node: chrome.bookmarks.BookmarkTreeNode) => {
    if (node.url && /^https?:/.test(node.url)) urls.push(node.url);
    node.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return [...new Set(urls)];
}

function setImportStatus(text: string, kind: "ok" | "err" | "muted" = "muted") {
  const el = $("import-status");
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function startImportFlow() {
  const tree = await chrome.bookmarks.getTree();
  const urls = collectBookmarkUrls(tree);
  if (urls.length === 0) return setImportStatus("No bookmarks found.", "err");

  $("import-btn").classList.add("hidden");
  $("import-confirm").classList.remove("hidden");
  $("import-count").textContent =
    `Found ${urls.length} bookmark${urls.length === 1 ? "" : "s"}. Import them all?`;
  setImportStatus("");
}

function cancelImportFlow() {
  $("import-confirm").classList.add("hidden");
  $("import-btn").classList.remove("hidden");
  setImportStatus("");
}

async function runImport() {
  const token = await getToken();
  if (!token) return showAuth();

  const tree = await chrome.bookmarks.getTree();
  const urls = collectBookmarkUrls(tree);
  $("import-confirm").classList.add("hidden");

  let created = 0;
  let skipped = 0;
  for (let i = 0; i < urls.length; i += IMPORT_BATCH) {
    setImportStatus(`Importing… ${Math.min(i + IMPORT_BATCH, urls.length)}/${urls.length}`);
    const res = await apiFetch(
      "/pages/import",
      { method: "POST", body: JSON.stringify({ urls: urls.slice(i, i + IMPORT_BATCH) }) },
      token,
    ).catch(() => null);

    if (res && res.status === 401) {
      await chrome.storage.local.remove("token");
      return showAuth("Session expired — please log in again.");
    }
    if (!res || !res.ok) {
      $("import-btn").classList.remove("hidden");
      return setImportStatus("Import failed — try again in a few minutes.", "err");
    }
    const out = await res.json();
    created += out.created;
    skipped += out.skipped;
  }

  setImportStatus(`✓ Imported ${created} (${skipped} already saved).`, "ok");
  const status = $("import-status");
  const link = document.createElement("a");
  link.href = `${WEB_APP_URL}/review`;
  link.target = "_blank";
  link.textContent = "Review them now ↗";
  link.style.cssText = "display:block;margin-top:4px;color:var(--accent)";
  status.appendChild(link);
  $("import-btn").classList.remove("hidden");
}

// --- wire up --------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  $("login-btn").addEventListener("click", () => authenticate("/auth/login"));
  $("register-btn").addEventListener("click", () => authenticate("/auth/register"));
  $("google-btn").addEventListener("click", signInWithGoogle);
  $("save-btn").addEventListener("click", savePage);
  $("import-btn").addEventListener("click", startImportFlow);
  $("import-yes").addEventListener("click", runImport);
  $("import-no").addEventListener("click", cancelImportFlow);
  $("logout-btn").addEventListener("click", async () => {
    await chrome.storage.local.remove("token");
    showAuth();
  });
  $("password").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") authenticate("/auth/login");
  });

  if (await getToken()) {
    await showSave();
  } else {
    showAuth();
  }
});
