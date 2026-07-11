"""Recompute embeddings for all ready pages with the current embedder.

Run after installing the `ml` extra so pages saved with the hashing fallback get
real sentence-transformer vectors. Uses stored text — no re-fetching.

    python -m scripts.reembed
"""
import asyncio

from sqlalchemy import select

from app.db import async_session
from app.models import Page, PageEmbedding
from app.services.embed import get_embedder


async def main() -> None:
    embedder = get_embedder()
    async with async_session() as db:
        pages = (await db.scalars(select(Page).where(Page.status == "ready"))).all()
        for page in pages:
            source = f"{page.title or ''}\n{page.summary or ''}\n{(page.clean_text or '')[:2000]}"
            vector = embedder.embed(source)
            existing = await db.get(PageEmbedding, page.id)
            if existing is None:
                db.add(PageEmbedding(page_id=page.id, embedding=vector))
            else:
                existing.embedding = vector
        await db.commit()
        print(f"re-embedded {len(pages)} page(s) with {type(embedder).__name__}")


if __name__ == "__main__":
    asyncio.run(main())
