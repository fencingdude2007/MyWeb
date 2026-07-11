"""The page-processing pipeline: fetch -> extract -> summarize -> embed -> store.

`process_page(page_id)` is deliberately a single standalone function. Today it's
scheduled via FastAPI BackgroundTasks; in Phase 6b it can become a Celery task
with no change to the body — only how it's invoked.
"""
import asyncio
import logging
from urllib.parse import unquote, urlparse

from sqlalchemy import delete, func, select

from app.config import settings
from app.db import async_session
from app.models import Entity, Page, PageEmbedding, PageTag, Posting, RelatedPage, Tag, User
from app.services.bm25 import term_frequencies
from app.services.drive import fetch_drive_text
from app.services.embed import get_embedder
from app.services.enrich import extract_keywords_entities
from app.services.extract import extract_content, fetch_html
from app.services.gdocs import google_match, google_site_name, is_google_workspace
from app.services.pdf import extract_pdf_text, fetch_pdf_bytes, is_pdf_url
from app.services.summarize import get_summarizer
from app.services.youtube import extract_video_id, fetch_oembed, fetch_transcript, is_youtube

logger = logging.getLogger("myweb.pipeline")


async def _extract_youtube(page: Page) -> None:
    """Populate a YouTube page from its metadata + transcript (no HTML snapshot;
    the web app embeds the live player instead)."""
    video_id = extract_video_id(page.url) or ""
    try:
        meta = await fetch_oembed(page.url)
    except Exception:
        meta = {}
    transcript = await asyncio.to_thread(fetch_transcript, video_id)

    page.title = meta.get("title") or page.title
    page.author = meta.get("author_name")
    page.site_name = "YouTube"
    page.snapshot_html = None  # the frontend embeds the player from the URL
    page.clean_text = transcript or (meta.get("title") or "")


async def _extract_pdf(page: Page) -> None:
    """Download the PDF and extract its text (frontend embeds the PDF itself)."""
    data = await asyncio.to_thread(extract_pdf_text, await fetch_pdf_bytes(page.url))
    fallback_title = unquote(urlparse(page.url).path.rsplit("/", 1)[-1])
    page.title = data["title"] or fallback_title
    page.site_name = urlparse(page.url).hostname
    page.snapshot_html = None  # the frontend embeds the PDF from the URL
    page.clean_text = data["text"]


async def _extract_google(page: Page, db) -> None:
    """Google Workspace file: display via /preview embed. Full text comes from
    the Drive API when the user signed in with Google (drive.readonly scope);
    otherwise best-effort from any captured DOM."""
    page.site_name = google_site_name(page.url)

    match = google_match(page.url)
    if match is not None:
        kind, file_id = match
        user = await db.get(User, page.user_id)
        if user is not None:
            drive_text = await fetch_drive_text(user, kind, file_id, db)
            if drive_text:
                page.clean_text = drive_text

    if page.snapshot_html:
        data = await asyncio.to_thread(extract_content, page.url, page.snapshot_html)
        page.title = data["title"] or page.title
        page.clean_text = page.clean_text or data["clean_text"]
    page.title = page.title or page.site_name or "Google file"
    page.clean_text = page.clean_text or page.title
    page.snapshot_html = None  # the frontend embeds the /preview instead


async def _refresh_related_pages(db, page_id: int, user_id: int) -> None:
    """Precompute this page's top-N cosine neighbors (and mirror the rows so
    the neighbors' detail views pick up the new page too)."""
    from sqlalchemy import text

    rows = list(
        await db.execute(
            text(
                """
                SELECT p.id, 1 - (pe.embedding <=> me.embedding) AS score
                FROM page_embeddings pe
                JOIN pages p ON p.id = pe.page_id
                JOIN page_embeddings me ON me.page_id = :pid
                WHERE p.user_id = :uid AND p.status = 'ready' AND p.id != :pid
                ORDER BY pe.embedding <=> me.embedding
                LIMIT :n
                """
            ),
            {"pid": page_id, "uid": user_id, "n": settings.related_pages_top_n},
        )
    )
    await db.execute(delete(RelatedPage).where(RelatedPage.page_id == page_id))
    for r in rows:
        db.add(RelatedPage(page_id=page_id, related_page_id=r.id, score=float(r.score)))
        # Mirror row: replace any existing (neighbor -> me) entry.
        await db.execute(
            delete(RelatedPage).where(
                RelatedPage.page_id == r.id, RelatedPage.related_page_id == page_id
            )
        )
        db.add(RelatedPage(page_id=r.id, related_page_id=page_id, score=float(r.score)))
    await db.commit()


async def process_page(page_id: int) -> None:
    async with async_session() as db:
        page = await db.get(Page, page_id)
        if page is None:
            return
        page.status = "processing"
        await db.commit()

        try:
            if is_youtube(page.url):
                # Videos: embed the player (frontend) and index the transcript.
                await _extract_youtube(page)
            elif is_pdf_url(page.url):
                await _extract_pdf(page)
            elif is_google_workspace(page.url):
                await _extract_google(page, db)
            else:
                # Prefer the live HTML the extension captured; otherwise fetch it
                # and keep the fetched copy as the snapshot to display.
                if page.snapshot_html:
                    html = page.snapshot_html
                else:
                    html = await fetch_html(page.url)
                    page.snapshot_html = html
                # trafilatura / spaCy / embedding are blocking; keep the loop free.
                data = await asyncio.to_thread(extract_content, page.url, html)
                page.title = data["title"]
                page.author = data["author"]
                page.site_name = data["site_name"]
                page.lang = data["lang"]
                page.published_at = data["published_at"]
                page.clean_text = data["clean_text"]

            summarizer = get_summarizer()
            page.summary = await summarizer.summarize(page.title or "", page.clean_text)

            embedder = get_embedder()
            embed_input = f"{page.title or ''}\n{page.summary or ''}\n{page.clean_text[:2000]}"
            vector = await asyncio.to_thread(embedder.embed, embed_input)
            keywords, entities = await asyncio.to_thread(
                extract_keywords_entities, page.clean_text
            )

            existing_embedding = await db.get(PageEmbedding, page_id)
            if existing_embedding is None:
                db.add(PageEmbedding(page_id=page_id, embedding=vector))
            else:
                existing_embedding.embedding = vector

            # Build the BM25 inverted index for this page (title + summary + body).
            index_text = f"{page.title or ''} {page.summary or ''} {page.clean_text}"
            term_freqs, page.token_count = term_frequencies(index_text)
            await db.execute(delete(Posting).where(Posting.page_id == page_id))
            for term, tf in term_freqs.items():
                db.add(Posting(page_id=page_id, term=term, tf=tf))

            for text, label in entities:
                db.add(Entity(page_id=page_id, text=text, label=label))

            for name in keywords:
                tag = await db.scalar(
                    select(Tag).where(Tag.user_id == page.user_id, Tag.name == name)
                )
                if tag is None:
                    tag = Tag(user_id=page.user_id, name=name)
                    db.add(tag)
                    await db.flush()
                db.add(PageTag(page_id=page_id, tag_id=tag.id))

            fts_source = f"{page.title or ''} {page.summary or ''} {page.clean_text}"
            page.fts = func.to_tsvector("english", fts_source)
            page.fetched_at = func.now()
            page.status = "ready"
            await db.commit()

            try:
                await _refresh_related_pages(db, page_id, page.user_id)
            except Exception:
                # Related-pages is a nice-to-have; never fail a ready page on it.
                logger.exception("related-pages precompute failed for page %s", page_id)

        except Exception:
            logger.exception("Failed to process page %s", page_id)
            await db.rollback()
            failed = await db.get(Page, page_id)
            if failed is not None:
                failed.status = "failed"
                await db.commit()
