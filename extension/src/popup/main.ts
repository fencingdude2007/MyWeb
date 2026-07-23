export {}; // module scope — keeps top-level names from clashing across entrypoints

// MyWeb popup: log in with email/password, then save the current tab.

// Server endpoints are configurable (Settings in the popup footer) so the same
// build works against localhost, your own server, or the hosted app.
const DEFAULT_API = "https://myweb-production-534b.up.railway.app";
const DEFAULT_WEB = "https://my-web-gilt-three.vercel.app";
let API_BASE = DEFAULT_API;
let WEB_APP_URL = DEFAULT_WEB;

const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, "");

async function loadConfig() {
  const { apiBase, webUrl } = await chrome.storage.local.get(["apiBase", "webUrl"]);
  if (apiBase) API_BASE = normalizeUrl(apiBase);
  if (webUrl) WEB_APP_URL = normalizeUrl(webUrl);
  ($("open-web") as HTMLAnchorElement).href = WEB_APP_URL;
}

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

  void loadCollections();
}

// Fill the "Save to collection" picker: none / existing / create-new.
async function loadCollections() {
  const token = await getToken();
  if (!token) return;
  const select = $<HTMLSelectElement>("collection-select");
  const { lastCollection } = await chrome.storage.local.get("lastCollection");

  const res = await apiFetch("/collections", {}, token).catch(() => null);
  const collections: { id: number; name: string }[] = res?.ok ? await res.json() : [];

  select.innerHTML = "";
  const add = (value: string, label: string) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  };
  add("", "No collection");
  for (const c of collections) add(String(c.id), c.name);
  add("__new__", "➕ New collection…");

  // Restore the last-used choice when it still exists.
  if (
    lastCollection &&
    Array.from(select.options).some((o) => o.value === String(lastCollection))
  ) {
    select.value = String(lastCollection);
  }
}

// Resolve the picker into a collection id, creating one when asked to.
async function resolveCollectionId(token: string): Promise<number | null | "error"> {
  const choice = $<HTMLSelectElement>("collection-select").value;
  if (!choice) return null;

  if (choice === "__new__") {
    const name = $<HTMLInputElement>("new-collection-name").value.trim();
    if (!name) return null;
    const res = await apiFetch(
      "/collections",
      { method: "POST", body: JSON.stringify({ name }) },
      token,
    ).catch(() => null);
    if (!res?.ok) return "error";
    const coll = await res.json();
    chrome.runtime.sendMessage({ type: "refresh-menus" }).catch(() => {});
    return coll.id;
  }
  return Number(choice);
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

// Grab the current rendered HTML of the page (the "saved state"), hardened so
// snapshots stay renderable long after capture: scripts stripped (they're
// blocked by the sandboxed viewer anyway), lazy-loaded images rescued, every
// URL absolutized against the live page, and the result size-capped.
async function capturePageHtml(tabId: number): Promise<string | null> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const MAX_BYTES = 2_500_000;
        const root = document.documentElement.cloneNode(true) as HTMLElement;

        // Scripts never run in the sandboxed snapshot viewer — drop them.
        root.querySelectorAll("script, noscript").forEach((el) => el.remove());

        const absolutize = (el: Element, attr: string) => {
          const v = el.getAttribute(attr);
          if (!v || /^(data:|https?:|#|mailto:|javascript:|blob:)/i.test(v)) return;
          try {
            el.setAttribute(attr, new URL(v, location.href).href);
          } catch {
            /* leave as-is */
          }
        };

        // Lazy loaders keep the real image in data-src; promote it so the
        // snapshot shows images that hadn't scrolled into view yet.
        root.querySelectorAll("img").forEach((img) => {
          const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-lazy-src");
          if (dataSrc && !(img.getAttribute("src") || "").startsWith("http")) {
            img.setAttribute("src", dataSrc);
          }
          img.removeAttribute("loading");
        });
        // srcset candidates stay relative after cloning — drop them so the
        // absolutized src wins.
        root.querySelectorAll("[srcset]").forEach((el) => el.removeAttribute("srcset"));

        root.querySelectorAll("img[src], source[src], video[src], audio[src]").forEach((el) =>
          absolutize(el, "src"),
        );
        root.querySelectorAll("a[href], link[href], area[href]").forEach((el) =>
          absolutize(el, "href"),
        );

        let html = "<!doctype html>" + root.outerHTML;
        // Browsers parse truncated HTML forgivingly; a capped snapshot beats none.
        if (html.length > MAX_BYTES) html = html.slice(0, MAX_BYTES);
        return html;
      },
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

  // Attach to the chosen collection (creating it first when "New collection…").
  const collectionId = await resolveCollectionId(token);
  if (collectionId === "error") {
    setStatus("Saved, but the collection couldn't be created.", "err");
  } else if (collectionId !== null) {
    await apiFetch(
      `/collections/${collectionId}/pages/${page.id}`,
      { method: "PUT" },
      token,
    ).catch(() => null);
    await chrome.storage.local.set({ lastCollection: collectionId });
    $<HTMLSelectElement>("collection-select").value = String(collectionId);
    $("new-collection-name").classList.add("hidden");
    $<HTMLInputElement>("new-collection-name").value = "";
  } else {
    await chrome.storage.local.set({ lastCollection: "" });
  }

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

// --- tab productivity: sweep & close / park it ------------------------------
function setActionStatus(text: string, kind: "ok" | "err" | "muted" = "muted") {
  const el = $("action-status");
  el.textContent = text;
  el.className = `status ${kind}`;
}

function appendActionLink(href: string, text: string) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.textContent = text;
  link.style.cssText = "display:block;margin-top:4px;color:var(--accent);text-decoration:none";
  $("action-status").appendChild(link);
}

async function collectionFromUrls(name: string, urls: string[], token: string) {
  return apiFetch(
    "/collections/from-urls",
    { method: "POST", body: JSON.stringify({ name, urls }) },
    token,
  ).catch(() => null);
}

// Save every savable tab in this window into a dated Session (tabs stay open) —
// the whole window becomes a searchable set you can reopen later.
async function sweepTabs() {
  const token = await getToken();
  if (!token) return showAuth();

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const savable = tabs.filter((t) => t.url && /^https?:/.test(t.url));
  const urls = [...new Set(savable.map((t) => t.url as string))];
  if (urls.length === 0) return setActionStatus("No savable tabs in this window.", "err");

  $<HTMLButtonElement>("sweep-btn").disabled = true;
  setActionStatus(`Saving ${urls.length} tab${urls.length === 1 ? "" : "s"}…`);

  const name = `Session · ${new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
  const res = await collectionFromUrls(name, urls, token);

  if (res && res.status === 401) {
    await chrome.storage.local.remove("token");
    return showAuth("Session expired — please log in again.");
  }
  if (!res || !res.ok) {
    $<HTMLButtonElement>("sweep-btn").disabled = false;
    return setActionStatus("Sweep failed — try again.", "err");
  }

  setActionStatus(`✓ Saved ${urls.length} tab${urls.length === 1 ? "" : "s"} to "${name}".`, "ok");
  appendActionLink(`${WEB_APP_URL}/collections`, "Open your sessions ↗");
  $<HTMLButtonElement>("sweep-btn").disabled = false;
}

// Defer a distracting tab into the shared "Later" list and close it — park the
// temptation instead of white-knuckling a block.
async function parkIt() {
  const token = await getToken();
  if (!token) return showAuth();
  const tab = await activeTab();
  if (!tab?.url || !/^https?:/.test(tab.url)) {
    return setActionStatus("This tab can't be parked.", "err");
  }

  $<HTMLButtonElement>("park-btn").disabled = true;
  setActionStatus("Parking…");
  const res = await collectionFromUrls("Later", [tab.url], token);

  if (res && res.status === 401) {
    await chrome.storage.local.remove("token");
    return showAuth("Session expired — please log in again.");
  }
  if (!res || !res.ok) {
    $<HTMLButtonElement>("park-btn").disabled = false;
    return setActionStatus("Couldn't park this tab.", "err");
  }

  setActionStatus("✓ Parked to your Later list.", "ok");
  if (tab.id) {
    try {
      await chrome.tabs.remove(tab.id);
    } catch {
      /* ignore */
    }
  }
  $<HTMLButtonElement>("park-btn").disabled = false;
}

// --- bookmark import --------------------------------------------------------
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
  $("sweep-btn").addEventListener("click", sweepTabs);
  $("park-btn").addEventListener("click", parkIt);
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

  $("collection-select").addEventListener("change", () => {
    const isNew = $<HTMLSelectElement>("collection-select").value === "__new__";
    $("new-collection-name").classList.toggle("hidden", !isNew);
    if (isNew) $<HTMLInputElement>("new-collection-name").focus();
  });

  await loadConfig();
  if (await getToken()) {
    await showSave();
  } else {
    showAuth();
  }
});
