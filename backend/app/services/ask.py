"""RAG over the user's saved pages: retrieve with hybrid search, answer with
Claude (or a citation-only fallback when no API key is configured)."""
import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Page
from app.services.search import hybrid_search

_SYSTEM_PROMPT = (
    "You answer questions using ONLY the user's saved web pages, provided as "
    "numbered sources. Cite sources inline like [1] or [2]. If the sources don't "
    "contain the answer, say so briefly. Be concise and factual."
)

_EXCERPT_CHARS = 3000


async def ask_pages(db: AsyncSession, user_id: int, question: str) -> dict:
    hits = await hybrid_search(db, user_id, question, limit=settings.ask_top_k, offset=0)
    if not hits:
        return {
            "question": question,
            "answer": "You have no saved pages to answer from yet.",
            "sources": [],
        }

    ids = [h["id"] for h in hits]
    pages = {
        p.id: p
        for p in await db.scalars(select(Page).where(Page.id.in_(ids)))
    }
    ordered = [pages[i] for i in ids if i in pages]

    sources = [
        {"id": p.id, "url": p.url, "title": p.title, "site_name": p.site_name}
        for p in ordered
    ]

    if not settings.anthropic_configured:
        listing = "\n".join(
            f"[{i + 1}] {p.title or p.url} — {(p.summary or '').strip()}"
            for i, p in enumerate(ordered)
        )
        return {
            "question": question,
            "answer": (
                "No AI model is configured (ANTHROPIC_API_KEY is empty), but these "
                f"saved pages look most relevant:\n{listing}"
            ),
            "sources": sources,
        }

    context = "\n\n".join(
        f"[{i + 1}] {p.title or p.url}\n{(p.clean_text or p.summary or '')[:_EXCERPT_CHARS]}"
        for i, p in enumerate(ordered)
    )
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        resp = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Sources:\n\n{context}\n\nQuestion: {question}",
                }
            ],
        )
        answer = "".join(b.text for b in resp.content if b.type == "text").strip()
    except anthropic.APIError:
        answer = (
            "The AI model couldn't be reached — here are the most relevant saved pages instead."
        )

    return {"question": question, "answer": answer, "sources": sources}
