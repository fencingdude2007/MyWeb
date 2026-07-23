export {}; // module scope — keeps top-level names from clashing across entrypoints

// "Save to new collection" dialog, opened by the context menu with ?url=…

const DEFAULT_API = "http://localhost:8000";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function apiBase(): Promise<string> {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  return ((apiBase as string) || DEFAULT_API).replace(/\/+$/, "");
}

async function api(path: string, init: RequestInit = {}): Promise<Response | null> {
  const { token } = await chrome.storage.local.get("token");
  if (!token) return null;
  const base = await apiBase();
  return fetch(base + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  }).catch(() => null);
}

function setStatus(text: string, kind: "ok" | "err" | "" = "") {
  const el = $("status");
  el.textContent = text;
  el.className = `status ${kind}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const url = new URLSearchParams(location.search).get("url") ?? "";
  $("url").textContent = url;

  const save = async () => {
    const name = $<HTMLInputElement>("name").value.trim();
    if (!name || !url) return;
    $<HTMLButtonElement>("save").disabled = true;
    setStatus("Saving…");

    const collRes = await api("/collections", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!collRes?.ok) {
      $<HTMLButtonElement>("save").disabled = false;
      return setStatus(
        collRes === null ? "Log in from the MyWeb popup first." : "Couldn't create the collection.",
        "err",
      );
    }
    const coll = await collRes.json();

    const pageRes = await api("/pages", { method: "POST", body: JSON.stringify({ url }) });
    if (!pageRes?.ok) {
      $<HTMLButtonElement>("save").disabled = false;
      return setStatus("Couldn't save the page.", "err");
    }
    const page = await pageRes.json();
    await api(`/collections/${coll.id}/pages/${page.id}`, { method: "PUT" });

    chrome.runtime.sendMessage({ type: "refresh-menus" }).catch(() => {});
    setStatus(`✓ Saved to “${name}”`, "ok");
    setTimeout(() => window.close(), 900);
  };

  $("save").addEventListener("click", save);
  $<HTMLInputElement>("name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
  });
  $("cancel").addEventListener("click", () => window.close());
});
