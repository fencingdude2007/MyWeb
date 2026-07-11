import uuid

from httpx import AsyncClient
from sqlalchemy import func

from app.db import async_session
from app.models import Page, PageEmbedding, Posting
from app.services.bm25 import term_frequencies
from app.services.embed import get_embedder

TOPICS = {
    "pg": (
        "PostgreSQL Indexing Guide",
        "How B-tree, GIN, and trigram indexes speed up database queries.",
    ),
    "cook": (
        "Sourdough Bread Recipe",
        "Baking sourdough with a wild yeast starter and a long fermentation.",
    ),
    "ml": (
        "Deploying Machine Learning Models",
        "Serving trained ML models in production with Docker and REST APIs.",
    ),
}


def _email() -> str:
    return f"pytest{uuid.uuid4().hex}@example.com"


async def _seed(user_id: int) -> None:
    embedder = get_embedder()
    async with async_session() as db:
        for key, (title, body) in TOPICS.items():
            page = Page(
                user_id=user_id,
                url=f"https://example.com/{key}",
                canonical_url=f"https://example.com/{key}",
                title=title,
                summary=body,
                clean_text=body,
                status="ready",
                fts=func.to_tsvector("english", f"{title} {body}"),
            )
            db.add(page)
            await db.flush()
            db.add(PageEmbedding(page_id=page.id, embedding=embedder.embed(f"{title}\n{body}")))

            # Build the BM25 inverted index for the seeded page.
            term_freqs, page.token_count = term_frequencies(f"{title} {body}")
            for term, tf in term_freqs.items():
                db.add(Posting(page_id=page.id, term=term, tf=tf))
        await db.commit()


async def test_hybrid_search_ranks_relevant_first(client: AsyncClient) -> None:
    r = await client.post("/auth/register", json={"email": _email(), "password": "pw123456"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    uid = (await client.get("/auth/me", headers=headers)).json()["id"]
    await _seed(uid)

    # Semantic: query words don't literally appear, but meaning matches the PG page.
    r = await client.get(
        "/search", params={"q": "make database queries faster"}, headers=headers
    )
    assert r.status_code == 200, r.text
    results = r.json()["results"]
    assert results, "expected results"
    assert results[0]["title"] == "PostgreSQL Indexing Guide"
    assert "signals" in results[0]

    # Keyword: exact term ranks its page first.
    r2 = await client.get("/search", params={"q": "sourdough"}, headers=headers)
    assert r2.json()["results"][0]["title"] == "Sourdough Bread Recipe"

    # Blank query returns recent pages rather than erroring.
    r3 = await client.get("/search", params={"q": ""}, headers=headers)
    assert r3.status_code == 200
    assert len(r3.json()["results"]) == 3
