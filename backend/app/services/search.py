"""Hybrid search: hand-built BM25 (keyword) + pgvector cosine (semantic) + pg_trgm (fuzzy title).

Ranking is our own code: BM25 is computed in app.services.bm25 against our
inverted index (no ts_rank). The embedding cosine and trigram title similarity
are the other two signals. Everything is normalized and combined with the
weights in settings. No LLM is involved.
"""
import asyncio
from collections import defaultdict
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.bm25 import bm25_scores, tokenize
from app.services.embed import get_embedder

# Semantic + trigram + recency + display fields for every ready page. Keyword
# (BM25) is added in Python. ts_headline is used only to build the highlighted
# snippet for display — it does not affect ranking.
_CANDIDATES_SQL = text(
    """
    SELECT p.id, p.url, p.title, p.summary, p.site_name, p.created_at,
        (p.is_favorite)::int                                             AS fav,
        COALESCE(1 - (pe.embedding <=> (:qvec)::vector), 0)              AS sem,
        similarity(COALESCE(p.title, ''), :q)                           AS trg,
        EXP(-EXTRACT(EPOCH FROM (now() - p.created_at)) / (86400 * 30.0)) AS recency,
        ts_headline(
            'english', COALESCE(p.clean_text, p.summary, ''),
            websearch_to_tsquery('english', :q),
            'MaxWords=32, MinWords=12, ShortWord=3, MaxFragments=1'
        ) AS snippet
    FROM pages p
    LEFT JOIN page_embeddings pe ON pe.page_id = p.id
    WHERE p.user_id = :uid AND p.status = 'ready'
    """
)

_CORPUS_SQL = text(
    """
    SELECT count(*) AS n, COALESCE(avg(token_count), 1) AS avgdl
    FROM pages WHERE user_id = :uid AND status = 'ready'
    """
)

_POSTINGS_SQL = text(
    """
    SELECT po.page_id, po.term, po.tf, p.token_count
    FROM postings po
    JOIN pages p ON p.id = po.page_id
    WHERE p.user_id = :uid AND p.status = 'ready' AND po.term IN :terms
    """
).bindparams(bindparam("terms", expanding=True))

_RECENT_SQL = text(
    """
    SELECT id, url, title, summary, site_name, created_at,
           0 AS fav, 0.0 AS sem, 0.0 AS trg, 0.0 AS recency,
           LEFT(COALESCE(summary, ''), 220) AS snippet
    FROM pages
    WHERE user_id = :uid AND status = 'ready'
    ORDER BY created_at DESC
    LIMIT :limit OFFSET :offset
    """
)


def _vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"


async def _bm25_by_page(db: AsyncSession, user_id: int, terms: list[str]) -> dict[int, float]:
    if not terms:
        return {}
    corpus = (await db.execute(_CORPUS_SQL, {"uid": user_id})).one()
    rows = list(await db.execute(_POSTINGS_SQL, {"uid": user_id, "terms": terms}))

    doc_len: dict[int, int] = {}
    df_sets: dict[str, set[int]] = defaultdict(set)
    postings: list[tuple[int, str, int]] = []
    for r in rows:
        postings.append((r.page_id, r.term, r.tf))
        doc_len[r.page_id] = r.token_count
        df_sets[r.term].add(r.page_id)

    doc_freq = {term: len(pages) for term, pages in df_sets.items()}
    return bm25_scores(postings, doc_len, doc_freq, int(corpus.n), float(corpus.avgdl))


def _result(row: Any, keyword: float) -> dict[str, Any]:
    return {
        "id": row.id,
        "url": row.url,
        "title": row.title,
        "summary": row.summary,
        "site_name": row.site_name,
        "created_at": row.created_at,
        "snippet": (row.snippet or "").strip(),
        "signals": {
            "semantic": round(float(row.sem), 4),
            "keyword": round(keyword, 4),
            "trigram": round(float(row.trg), 4),
            "recency": round(float(row.recency), 4),
            "favorite": float(row.fav),
        },
    }


async def hybrid_search(
    db: AsyncSession, user_id: int, query: str, limit: int, offset: int
) -> list[dict[str, Any]]:
    query = query.strip()
    if not query:
        rows = await db.execute(_RECENT_SQL, {"uid": user_id, "limit": limit, "offset": offset})
        return [_result(r, 0.0) | {"score": 0.0} for r in rows]

    terms = tokenize(query)
    embedder = get_embedder()
    qvec = await asyncio.to_thread(embedder.embed, query)

    params = {"uid": user_id, "q": query, "qvec": _vector_literal(qvec)}
    rows = list(await db.execute(_CANDIDATES_SQL, params))
    bm25 = await _bm25_by_page(db, user_id, terms)
    max_bm25 = max(bm25.values(), default=0.0) or 1.0  # normalize BM25 to 0..1

    results: list[dict[str, Any]] = []
    for row in rows:
        keyword = bm25.get(row.id, 0.0) / max_bm25
        score = (
            settings.search_w_semantic * float(row.sem)
            + settings.search_w_keyword * keyword
            + settings.search_w_trigram * float(row.trg)
            + settings.search_w_recency * float(row.recency)
            + settings.search_w_favorite * float(row.fav)
        )
        results.append(_result(row, keyword) | {"score": round(score, 4)})

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[offset : offset + limit]
