export {}; // module scope — keeps top-level names from clashing across entrypoints

// MyWeb background worker: right-click "Save to MyWeb" on any link or page,
// straight into a collection if you want — from Google results, articles,
// anywhere. Feedback comes through the toolbar-icon badge.

const DEFAULT_API = "https://myweb-production-534b.up.railway.app";

async function apiBase(): Promise<string> {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  return ((apiBase as string) || DEFAULT_API).replace(/\/+$/, "");
}

async function getToken(): Promise<string | null> {
  const { token } = await chrome.storage.local.get("token");
  return (token as string) ?? null;
}

async function api(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = await getToken();
  if (!token) return null;
  const base = await apiBase();
  return fetch(base + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string>),
    },
  }).catch(() => null);
}

function flashBadge(ok: boolean) {
  chrome.action.setBadgeBackgroundColor({ color: ok ? "#22c55e" : "#ef4444" });
  chrome.action.setBadgeText({ text: ok ? "✓" : "!" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3500);
}

// --- context menus ----------------------------------------------------------

const ROOT = "myweb-root";
const CONTEXTS: chrome.contextMenus.ContextType[] = ["link", "page"];
const MAX_MENU_COLLECTIONS = 12;

function createMenu(props: chrome.contextMenus.CreateProperties) {
  chrome.contextMenus.create(props, () => void chrome.runtime.lastError);
}

async function rebuildMenus() {
  await chrome.contextMenus.removeAll();
  createMenu({ id: ROOT, title: "MyWeb", contexts: CONTEXTS });
  createMenu({ id: "save", parentId: ROOT, title: "Save to MyWeb", contexts: CONTEXTS });

  const res = await api("/collections");
  if (res?.ok) {
    const collections: { id: number; name: string }[] = await res.json();
    if (collections.length > 0) {
      createMenu({ id: "sep", parentId: ROOT, type: "separator", contexts: CONTEXTS });
      for (const c of collections.slice(0, MAX_MENU_COLLECTIONS)) {
        createMenu({
          id: `col-${c.id}`,
          parentId: ROOT,
          title: `Add to “${c.name}”`,
          contexts: CONTEXTS,
        });
      }
    }
  }
  createMenu({ id: "col-new", parentId: ROOT, title: "New collection…", contexts: CONTEXTS });
}

// --- actions ----------------------------------------------------------------

async function savePage(url: string): Promise<number | null> {
  const res = await api("/pages", { method: "POST", body: JSON.stringify({ url }) });
  if (!res?.ok) return null;
  const page = await res.json();
  return page.id as number;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Right-clicked a link → save the link target; otherwise the current page.
  const url = info.linkUrl || info.pageUrl || tab?.url;
  if (!url || !/^https?:/.test(url)) return flashBadge(false);
  const id = String(info.menuItemId);

  if (id === "col-new") {
    const dialog =
      chrome.runtime.getURL("src/dialog/index.html") + `?url=${encodeURIComponent(url)}`;
    chrome.windows.create({ url: dialog, type: "popup", width: 380, height: 300 });
    return;
  }

  if (id === "save") {
    flashBadge((await savePage(url)) !== null);
    return;
  }

  if (id.startsWith("col-")) {
    const collectionId = Number(id.slice(4));
    const pageId = await savePage(url);
    if (pageId === null) return flashBadge(false);
    const res = await api(`/collections/${collectionId}/pages/${pageId}`, { method: "PUT" });
    flashBadge(!!res?.ok);
  }
});

// Keep the menu in sync: on install/startup, when auth changes, and when the
// popup or dialog reports that collections changed.
chrome.runtime.onInstalled.addListener(() => void rebuildMenus());
chrome.runtime.onStartup.addListener(() => void rebuildMenus());
chrome.storage.onChanged.addListener((changes) => {
  if (changes.token || changes.apiBase) void rebuildMenus();
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "refresh-menus") void rebuildMenus();
});
