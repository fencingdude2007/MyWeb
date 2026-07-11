// Configurable for deployment; defaults to the local backend.
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

const ACCESS_KEY = "myweb_access";
const REFRESH_KEY = "myweb_refresh";

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, { ...opts, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.detail || res.statusText);
  return data as T;
}

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Page {
  id: number;
  url: string;
  canonical_url: string;
  title: string | null;
  author: string | null;
  site_name: string | null;
  summary: string | null;
  status: string;
  source: string;
  needs_review: boolean;
  is_favorite: boolean;
  created_at: string;
  published_at: string | null;
  fetched_at: string | null;
  snapshot?: string | null;
  content?: string | null;
}

export interface Collection {
  id: number;
  name: string;
  created_at: string;
  page_count: number;
}

export interface Note {
  id: number;
  page_id: number;
  body: string;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  page_count: number;
}

export interface RelatedPage {
  id: number;
  url: string;
  title: string | null;
  site_name: string | null;
  score: number;
}

export interface Suggestion {
  title: string;
  url: string;
  snippet: string;
}

export interface AskSource {
  id: number;
  url: string;
  title: string | null;
  site_name: string | null;
}

export interface AskResponse {
  question: string;
  answer: string;
  sources: AskSource[];
}

export interface Stats {
  total_pages: number;
  ready_pages: number;
  favorite_pages: number;
  total_collections: number;
  total_notes: number;
  saves_per_day: { day: string; count: number }[];
  top_tags: { name: string; count: number }[];
  top_sites: { name: string; count: number }[];
}

export interface SearchResult {
  id: number;
  url: string;
  title: string | null;
  summary: string | null;
  site_name: string | null;
  created_at: string;
  snippet: string;
  score: number;
  signals: { semantic: number; keyword: number; trigram: number; recency: number };
}

export interface SearchResponse {
  query: string;
  count: number;
  results: SearchResult[];
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export const api = {
  register: (email: string, password: string) =>
    request<TokenPair>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<TokenPair>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),
  setPassword: (password: string) =>
    request<void>("/auth/set-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  search: (q: string) => request<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),
  savePage: (url: string) =>
    request<Page>("/pages", { method: "POST", body: JSON.stringify({ url }) }),
  listPages: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<Page[]>(`/pages${qs ? `?${qs}` : ""}`);
  },
  getPage: (id: number | string) => request<Page>(`/pages/${id}`),
  updatePage: (id: number | string, data: { is_favorite?: boolean; needs_review?: boolean }) =>
    request<Page>(`/pages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePage: (id: number | string) =>
    request<void>(`/pages/${id}`, { method: "DELETE" }),
  trackVisit: (id: number | string) =>
    request<void>(`/pages/${id}/visit`, { method: "POST" }),
  relatedPages: (id: number | string) => request<RelatedPage[]>(`/pages/${id}/related`),

  // Collections
  listCollections: () => request<Collection[]>("/collections"),
  createCollection: (name: string) =>
    request<Collection>("/collections", { method: "POST", body: JSON.stringify({ name }) }),
  deleteCollection: (id: number) => request<void>(`/collections/${id}`, { method: "DELETE" }),
  getCollection: (id: number | string) => request<Collection>(`/collections/${id}`),
  collectionPages: (id: number | string) => request<Page[]>(`/collections/${id}/pages`),
  addToCollection: (collectionId: number, pageId: number) =>
    request<void>(`/collections/${collectionId}/pages/${pageId}`, { method: "PUT" }),
  removeFromCollection: (collectionId: number, pageId: number) =>
    request<void>(`/collections/${collectionId}/pages/${pageId}`, { method: "DELETE" }),
  collectionSuggestions: (id: number | string) =>
    request<Suggestion[]>(`/collections/${id}/suggestions`),

  // Notes
  listNotes: (pageId: number | string) => request<Note[]>(`/pages/${pageId}/notes`),
  createNote: (pageId: number | string, body: string) =>
    request<Note>(`/pages/${pageId}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
  deleteNote: (noteId: number) => request<void>(`/notes/${noteId}`, { method: "DELETE" }),

  // Tags / ask / stats
  listTags: () => request<Tag[]>("/tags"),
  ask: (question: string) =>
    request<AskResponse>("/ask", { method: "POST", body: JSON.stringify({ question }) }),
  stats: () => request<Stats>("/stats"),
  exportData: () => request<unknown>("/export"),
};
