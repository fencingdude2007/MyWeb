# MyWeb AI — Tech Stack & Build Plan

A personal AI-powered search engine. Save any webpage with one click (Chrome extension), and later search your own "internet" using natural language. The core engineering value is a **hybrid information-retrieval system** (semantic + keyword + signals), not a chatbot.

---

## 1. Tech Stack (finalized)

### Backend
- **Python 3.11+ / FastAPI** — REST API (save, search, auth, collections, notes).
- **Uvicorn** (dev) / **Gunicorn + Uvicorn workers** (prod) — ASGI server.
- **Pydantic v2** — request/response schemas + settings.
- **SQLAlchemy 2.0 (async) + Alembic** — ORM + migrations. *Don't hand-write SQL for schema; use migrations from day one.*
- **PostgreSQL 16** — primary datastore.
  - **pgvector** — semantic embedding search.
  - **Full-Text Search (tsvector) + GIN indexes** — keyword search.
  - **pg_trgm** — fuzzy/trigram matching for titles & typo tolerance.
- **Background work (deferred):** page processing (fetch → parse → summarize → embed → relate) runs **inside FastAPI via `BackgroundTasks`** to start — fewer moving parts while learning. **Redis + Celery** get added in Phase 6b once the pipeline is understood and needs to scale off the request path.
- **Auth:** JWT (access + refresh) via `python-jose` + `passlib[bcrypt]` for email/password, **plus Google OAuth 2.0** (`authlib`) from the start. The Chrome extension uses `chrome.identity.launchWebAuthFlow` (or a hosted login page) to obtain the JWT.

### AI / NLP
- **Embeddings:** `sentence-transformers` — start with `all-MiniLM-L6-v2` (384-dim, fast, free). Upgrade path to `bge-base-en-v1.5` (768-dim) if quality needs it. **Keep the dimension in config — changing models means re-embedding.**
- **Content extraction:** `trafilatura` (best-in-class main-article extraction) with `readability-lxml` as fallback. `BeautifulSoup4` for metadata scraping.
- **NLP:** `spaCy` (`en_core_web_sm`) for named-entity + keyword extraction.
- **Keywords/topics:** `KeyBERT` (uses your embedding model) or `scikit-learn` TF-IDF.
- **Summarization:** pluggable "LLM provider" interface.
  - Default: **Claude API** (`claude-haiku-4-5` for cheap/fast summaries) — cleanest quality-per-effort.
  - Alt/offline: local **Ollama** (Llama 3.1 / Mistral) behind the same interface.
  - *Design this as one `Summarizer` abstract class so the model is swappable.*

### Frontend
- **React 18 + TypeScript + Vite** — SPA.
- **TailwindCSS** + **shadcn/ui** (Radix primitives) — fast, clean components.
- **TanStack Query** — server state / caching / infinite scroll for results.
- **React Router** — routing.
- **Zustand** — light client state (auth, UI).

### Chrome Extension
- **Manifest V3**, plain TS + Vite (`@crxjs/vite-plugin`) so it shares tooling with the web app.
- Popup + background service worker. Sends the current tab URL (+ optional selected HTML) to the backend with the user's token.

### Infra / DevOps
- **Docker + docker-compose** — one command spins up api, worker, postgres (pgvector image), redis.
- **GitHub Actions** — lint (ruff), type-check (mypy), tests (pytest), build images.
- **Deploy:** **Railway** or **Render** first (managed Postgres + Redis, least ops). AWS later if you outgrow it.
- **Testing:** `pytest` + `httpx` (API), `Vitest` + React Testing Library (frontend).

### Key opinionated changes vs. the original spec
1. **Async SQLAlchemy + Alembic** instead of raw SQL — you'll iterate the schema constantly.
2. **trafilatura** is a big upgrade over generic BeautifulSoup for article extraction.
3. **Claude Haiku** as the default summarizer — cheaper to reason about than self-hosting an LLM early; keep the local-LLM option behind an interface.
4. **shadcn/ui + TanStack Query** so you're not hand-rolling components and fetching logic.

---

## 2. Data Model (first pass)

```
users(id, email, password_hash, created_at)
pages(id, user_id, url, canonical_url, title, author, published_at,
      site_name, lang, raw_html_ref, clean_text, summary,
      status[pending|processing|ready|failed], created_at, fetched_at,
      fts tsvector)                          -- GIN index on fts
page_embeddings(page_id, embedding vector(384))   -- ivfflat/hnsw index
tags(id, user_id, name)                      -- unique(user_id, name)
page_tags(page_id, tag_id)
entities(id, page_id, text, label)           -- spaCy NER
collections(id, user_id, name, created_at)
collection_pages(collection_id, page_id, added_at)
notes(id, user_id, page_id, body, created_at)
page_visits(id, user_id, page_id, visited_at) -- powers frequency signal
related_pages(page_id, related_page_id, score) -- precomputed similarity
```
Notes: dedupe on `(user_id, canonical_url)`. Store raw HTML in object storage (or a `raw_html` column early on), not inline in hot rows.

---

## 3. Hybrid Search — the core algorithm

> **Implemented note:** keyword ranking is a **hand-built BM25** over our own
> inverted index (`postings` table + `app/services/bm25.py`), not Postgres
> `ts_rank`. Semantic uses pgvector cosine; fuzzy title uses pg_trgm. FTS
> (`ts_headline`) is used only to build the highlighted snippet, not to rank.

On query:
1. Embed the query (same model as pages) → **pgvector** cosine top-K (semantic candidates).
2. **FTS** (`websearch_to_tsquery`) + **pg_trgm** on title → keyword candidates.
3. Merge candidate sets, then **re-rank** with a weighted score:
   ```
   score = w1*semantic_sim
         + w2*fts_rank
         + w3*trgm_title_sim
         + w4*recency_decay
         + w5*visit_frequency
         + w6*is_favorite
   ```
   Start with hand-tuned weights; expose them in config. (Reciprocal Rank Fusion is a good alternative to weighted sum.)
4. Return page + highlighted snippet + score breakdown (useful for debugging relevance).

---

## 4. Phased Build Plan (each phase = one Claude Code prompt)

> Paste these one at a time into Claude Code. Each ends in something runnable/testable. Don't skip ahead — later phases assume earlier scaffolding.

### Phase 0 — Repo & infra scaffolding ✅ DONE
```
Set up a monorepo for "MyWeb AI" with three top-level dirs: /backend (FastAPI),
/frontend (React+Vite+TS+Tailwind+shadcn), /extension (MV3 + Vite).
Add a root docker-compose.yml with services: api, postgres
(pgvector/pgvector:pg16 image). Add backend pyproject.toml with FastAPI,
SQLAlchemy async, Alembic, pydantic-settings, ruff, mypy, pytest.
Add a /health endpoint and a README with run instructions. Verify
`docker compose up` starts everything and /health returns 200.
```
(No Redis/Celery yet — background processing is deferred to Phase 6b.)

### Phase 1 — Auth + core schema + migrations ✅ DONE
```
In /backend, implement JWT auth (register, login, refresh, /me) with bcrypt
password hashing AND Google OAuth 2.0 via authlib: a /auth/google/login redirect
and /auth/google/callback that upserts the user (users table gets nullable
password_hash + a google_sub column) and returns our own JWT. Create SQLAlchemy
models and Alembic migrations for the data
model in PLAN.md section 2 (users, pages, page_embeddings with pgvector,
tags, page_tags, entities, collections, notes, page_visits). Enable the vector
and pg_trgm extensions in a migration. Add pytest tests for the auth flow.
```

### Phase 2 — Save endpoint + ingestion pipeline ✅ DONE
```
Implement POST /pages that accepts a URL (auth required), creates a page row
with status=pending, and schedules processing with FastAPI BackgroundTasks
(structured as one process_page(page_id) function so it can later move to Celery
untouched). The processing: fetch the HTML, extract main content with trafilatura
(readability fallback), pull title/author/published_at/site_name, generate a
summary via a pluggable Summarizer interface (default: Claude claude-haiku-4-5,
with an Ollama fallback impl), extract keywords (KeyBERT) and entities (spaCy),
compute a sentence-transformers embedding (all-MiniLM-L6-v2), and populate the
fts tsvector. Store everything and set status=ready. Dedupe on
(user_id, canonical_url). Add tests with a mocked Summarizer and a fixture HTML
page. Add GET /pages/{id} so the client can poll processing status.
```

### Phase 3 — Chrome extension ✅ DONE (email/password login; Google-in-extension deferred)
```
Build the MV3 extension in /extension: a popup with a "Save to MyWeb" button and
a "Sign in with Google" button that uses chrome.identity.launchWebAuthFlow to run
the OAuth flow and stores the returned JWT in chrome.storage. On click, send the
active tab's URL to
POST /pages with the auth header, show success/error + processing status. Include
build instructions for loading the unpacked extension.
```

### Phase 4 — Hybrid search API ✅ DONE
```
Implement GET /search?q=... implementing the hybrid ranking in PLAN.md section 3:
pgvector semantic top-K + Postgres FTS (websearch_to_tsquery) + pg_trgm title
match, merged with a weighted re-rank (weights in config), returning page data,
a highlighted snippet, and per-signal score breakdown. Add pagination. Write
tests seeding ~20 pages and asserting relevant ordering for sample queries.
```

### Phase 5 — Web app (search UI) ✅ DONE
```
Build the React app: login/register, a homepage with a large natural-language
search bar, results list (title, summary snippet, source, tags, saved date) using
TanStack Query with infinite scroll, and a page detail view (full summary, notes,
related pages, tags, "visit" tracking that hits page_visits). Use shadcn/ui +
Tailwind. Wire auth token handling and protected routes.
```

### Phase 5.5 — Library view & page management ✅ DONE
```
Add a /library page in the web app that lists all saved pages via GET /pages
(filters: favorites, tag; imported-pages review link), with per-page delete
(DELETE /pages/{id}) and a favorite toggle (PATCH /pages/{id}). Surface nav
links (Search / Library / Collections / Ask / Dashboard) in the app header.
```

### Phase 6 — Organization features ✅ DONE
```
Add collections (create, add/remove pages), notes/highlights per page, tag
management + filter-by-tag, and a favorites flag that feeds the search ranking.
Add the related_pages precompute (a BackgroundTask computing top-N cosine
neighbors per new page) and surface "Related pages" on the detail view.
```
> Bonus shipped with this phase: **suggested sites per collection** — the
> backend builds a query from the collection's name + its pages' tags, scrapes
> DuckDuckGo's free HTML results, filters out already-saved URLs, and the
> collection view offers one-click saves (GET /collections/{id}/suggestions).

### Phase 6c — Google Drive full-text extraction ✅ DONE
```
Add the drive.readonly scope to Google OAuth (offline access + consent prompt),
store the user's Google access/refresh tokens, and export the full text of
saved Google Docs/Sheets/Slides via the Drive files.export API in the pipeline
(with automatic token refresh and graceful fallback to DOM text when there is
no token). The Drive API is free.
```
> Caveats: users who signed in before this scope existed must sign in with
> Google again to grant Drive access. While the OAuth app is in "Testing" mode,
> Google expires refresh tokens after 7 days; publishing with a restricted
> scope like drive.readonly triggers Google's verification process (only
> relevant if the app is opened to the public).

### Phase 6b — Move processing to Redis + Celery (optional, when ready)
```
Introduce Redis + Celery. Add redis and worker services to docker-compose and
the celery/redis deps to backend. Move the existing process_page(page_id) and
related_pages precompute from FastAPI BackgroundTasks into Celery tasks (the
function bodies shouldn't need to change — just the way they're invoked). POST
/pages should now enqueue instead of scheduling a BackgroundTask. Verify the
worker picks up and completes a save end-to-end.
```
> Do this once you understand the pipeline and want the "real" production
> pattern (survives restarts, scales, retries). It's a swap, not a rewrite —
> that's why Phase 2 keeps the logic in a standalone `process_page` function.

### Phase 7 — Dashboard & polish ✅ DONE
```
Build a dashboard: reading activity over time, top topics/tags, most-visited
sites, and knowledge-growth stats, plus a full JSON data export. Add per-user
rate limiting on the save/import/ask endpoints, a public landing page for
logged-out visitors, and a CI GitHub Actions workflow (ruff, pytest,
frontend/extension builds).
```

### Phase 8 — Ask your pages (RAG chat) ✅ DONE
```
Add POST /ask: embed the question, retrieve the top-K pages with the existing
hybrid search, build a numbered-source context from their text, and answer with
Claude (citing sources like [1]); fall back to a relevant-pages listing when no
API key is configured. Add an /ask page in the web app showing the answer and
linked source pages.
```

### Phase 9 — Onboarding: bookmark import + review ✅ DONE
```
Extension: an "Import Chrome bookmarks" flow (bookmarks permission) that counts
the user's bookmarks, confirms, and bulk-posts them to POST /pages/import.
Backend: creates pages with source=import + needs_review=true, dedupes against
existing saves, and processes them sequentially in the background. Web app: a
/review page listing imported pages where the user keeps (clears the flag) or
deletes each one, with a "Keep all" shortcut.
```

---

## 5. Milestone definition of done
- **MVP (Phases 0–5):** save a page from Chrome → it's processed → search it in natural language and get relevant results. This alone is a demoable, portfolio-worthy project. ✅
- **Full (Phases 5.5–9, excluding 6b):** library management, collections (with suggested-sites web scrape), notes, related pages, Google Drive full text, dashboard + export, RAG "ask your pages", bookmark-import onboarding, rate limiting, landing page, CI. ✅
- **Deferred:** Phase 6b (Redis + Celery) — swap BackgroundTasks for a real queue when scale demands it.

## 6. Early risks to watch
- **Embedding model lock-in** — changing models requires re-embedding all pages. Keep dim + model name in config.
- **Extraction quality** varies by site — always keep clean_text + summary even if some fields are null.
- **Vector index tuning** — use `hnsw` (pgvector ≥0.5) for recall/speed; revisit `lists`/`ef_search` as data grows.
- **Cost/latency of summarization** — it's the slow step; keep it off the response path (a BackgroundTask now, Celery later — Phase 6b).
```
