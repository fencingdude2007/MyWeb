"""Rebuild search artifacts for all ready pages: BM25 postings, token_count,
embeddings, and a cleanup of junk author values. Uses stored text (no refetch).

    python -m scripts.reindex
"""
import asyncio

from sqlalchemy import delete, select

from app.db import async_session
from app.models import Page, PageEmbedding, Posting
from app.services.bm25 import term_frequencies
from app.services.embed import get_embedder


def _clean_author(author: str | None) -> str | None:
    if not author:
        return None
    lowered = author.lower()
    if "authority control" in lowered or "edit links" in lowered or len(author) > 120:
        return None
    return author


async def main() -> None:
    embedder = get_embedder()
    async with async_session() as db:
        pages = (await db.scalars(select(Page).where(Page.status == "ready"))).all()
        for page in pages:
            page.author = _clean_author(page.author)

            index_text = f"{page.title or ''} {page.summary or ''} {page.clean_text or ''}"
            term_freqs, page.token_count = term_frequencies(index_text)
            await db.execute(delete(Posting).where(Posting.page_id == page.id))
            for term, tf in term_freqs.items():
                db.add(Posting(page_id=page.id, term=term, tf=tf))

            source = f"{page.title or ''}\n{page.summary or ''}\n{(page.clean_text or '')[:2000]}"
            vector = embedder.embed(source)
            existing = await db.get(PageEmbedding, page.id)
            if existing is None:
                db.add(PageEmbedding(page_id=page.id, embedding=vector))
            else:
                existing.embedding = vector

        await db.commit()
        print(f"reindexed {len(pages)} page(s) with {type(embedder).__name__}")


if __name__ == "__main__":
    asyncio.run(main())
