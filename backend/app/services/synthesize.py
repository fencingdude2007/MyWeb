"""Synthesize a whole collection into one cited brief — the anti-context-switch
feature: read one synthesized page instead of re-opening a dozen tabs.

Reuses the same Claude-or-fallback shape as the RAG `ask` service, but the
context is every page in the collection (not a search retrieval)."""
import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import CollectionPage, Page

_SYSTEM_PROMPT = (
    "You are given the user's saved web pages from a single collection, as "
    "numbered sources. Write a concise brief (a few short paragraphs) that pulls "
    "out the through-line across them: the shared themes, the key takeaways, and "
    "any tensions or disagreements between sources. Cite sources inline like [1] "
    "or [2]. Use only what the sources say."
)

_EXCERPT_CHARS = 2500
_MAX_PAGES = 12


async def synthesize_collection(
    db: AsyncSession, user_id: int, collection_id: int
) -> dict:
    pages = list(
        await db.scalars(
            select(Page)
            .join(CollectionPage, CollectionPage.page_id == Page.id)
            .where(CollectionPage.collection_id == collection_id, Page.user_id == user_id)
            .order_by(CollectionPage.added_at.desc())
            .limit(_MAX_PAGES)
        )
    )
    if not pages:
        return {"summary": "This collection is empty — add some pages first.", "sources": []}

    sources = [
        {"id": p.id, "url": p.url, "title": p.title, "site_name": p.site_name}
        for p in pages
    ]

    if not settings.anthropic_configured:
        listing = "\n".join(
            f"[{i + 1}] {p.title or p.url} — {(p.summary or '').strip()}"
            for i, p in enumerate(pages)
        )
        return {
            "summary": (
                "No AI model is configured (ANTHROPIC_API_KEY is empty). Here's what "
                f"this collection contains:\n{listing}"
            ),
            "sources": sources,
        }

    context = "\n\n".join(
        f"[{i + 1}] {p.title or p.url}\n{(p.clean_text or p.summary or '')[:_EXCERPT_CHARS]}"
        for i, p in enumerate(pages)
    )
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        resp = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Sources:\n\n{context}\n\nWrite the brief."}],
        )
        summary = "".join(b.text for b in resp.content if b.type == "text").strip()
    except anthropic.APIError:
        summary = "The AI model couldn't be reached — try again in a moment."

    return {"summary": summary, "sources": sources}
