import asyncio
from typing import Annotated
from urllib.parse import urldefrag

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import Page, PageTag, PageVisit, RelatedPage, Tag, User
from app.ratelimit import check_rate_limit
from app.schemas import (
    ImportIn,
    ImportOut,
    PageCreate,
    PageDetail,
    PageOut,
    PageUpdate,
    RelatedPageOut,
)
from app.services.pipeline import process_page

router = APIRouter(prefix="/pages", tags=["pages"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def canonicalize(url: str) -> str:
    """Drop the #fragment and any trailing slash for dedupe purposes."""
    clean, _ = urldefrag(url)
    return clean.rstrip("/") or clean


@router.post("", response_model=PageOut, status_code=status.HTTP_202_ACCEPTED)
async def save_page(
    data: PageCreate, background: BackgroundTasks, user: CurrentUser, db: DbSession
) -> Page:
    check_rate_limit(user.id, "save", limit=30, window_seconds=60)
    canonical = canonicalize(str(data.url))
    existing = await db.scalar(
        select(Page).where(Page.user_id == user.id, Page.canonical_url == canonical)
    )
    if existing is not None:
        # Already saved. If a previous attempt failed, retry processing.
        if existing.status == "failed":
            if data.html:
                existing.snapshot_html = data.html
            existing.status = "pending"
            await db.commit()
            background.add_task(process_page, existing.id)
        return existing

    page = Page(
        user_id=user.id,
        url=str(data.url),
        canonical_url=canonical,
        snapshot_html=data.html,  # live capture from the extension, if provided
        status="pending",
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)

    background.add_task(process_page, page.id)
    return page


async def _process_sequentially(page_ids: list[int]) -> None:
    """Process imported pages one at a time so a bulk import doesn't hammer
    the DB/embedder/summarizer all at once."""
    for pid in page_ids:
        try:
            await process_page(pid)
        except Exception:  # noqa: BLE001 — keep importing even if one page dies
            pass
        await asyncio.sleep(0.2)


@router.post("/import", response_model=ImportOut, status_code=status.HTTP_202_ACCEPTED)
async def import_pages(
    data: ImportIn, background: BackgroundTasks, user: CurrentUser, db: DbSession
) -> ImportOut:
    """Bulk import (Chrome bookmarks). Created pages are flagged needs_review
    so the user can keep/delete them in the review flow."""
    check_rate_limit(user.id, "import", limit=3, window_seconds=300)

    existing_urls = set(
        (
            await db.scalars(select(Page.canonical_url).where(Page.user_id == user.id))
        ).all()
    )

    created_ids: list[int] = []
    skipped = 0
    seen: set[str] = set()
    for url in data.urls:
        canonical = canonicalize(str(url))
        if canonical in existing_urls or canonical in seen:
            skipped += 1
            continue
        seen.add(canonical)
        page = Page(
            user_id=user.id,
            url=str(url),
            canonical_url=canonical,
            status="pending",
            source="import",
            needs_review=True,
        )
        db.add(page)
        await db.flush()
        created_ids.append(page.id)
    await db.commit()

    if created_ids:
        background.add_task(_process_sequentially, created_ids)
    return ImportOut(created=len(created_ids), skipped=skipped)


@router.get("", response_model=list[PageOut])
async def list_pages(
    user: CurrentUser,
    db: DbSession,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    site: str | None = None,
    tag: str | None = None,
    favorites: bool = False,
    needs_review: bool | None = None,
) -> list[Page]:
    stmt = select(Page).where(Page.user_id == user.id)
    if site:
        stmt = stmt.where(Page.site_name == site)
    if favorites:
        stmt = stmt.where(Page.is_favorite.is_(True))
    if needs_review is not None:
        stmt = stmt.where(Page.needs_review.is_(needs_review))
    if tag:
        stmt = (
            stmt.join(PageTag, PageTag.page_id == Page.id)
            .join(Tag, Tag.id == PageTag.tag_id)
            .where(Tag.user_id == user.id, Tag.name == tag)
        )
    rows = await db.scalars(stmt.order_by(Page.created_at.desc()).limit(limit).offset(offset))
    return list(rows)


@router.get("/{page_id}", response_model=PageDetail)
async def get_page(page_id: int, user: CurrentUser, db: DbSession) -> PageDetail:
    page = await db.get(Page, page_id)
    if page is None or page.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    detail = PageDetail.model_validate(page)
    detail.snapshot = page.snapshot_html
    detail.content = page.clean_text
    return detail


@router.patch("/{page_id}", response_model=PageOut)
async def update_page(
    page_id: int, data: PageUpdate, user: CurrentUser, db: DbSession
) -> Page:
    page = await db.get(Page, page_id)
    if page is None or page.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    if data.is_favorite is not None:
        page.is_favorite = data.is_favorite
    if data.needs_review is not None:
        page.needs_review = data.needs_review
    await db.commit()
    await db.refresh(page)
    return page


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(page_id: int, user: CurrentUser, db: DbSession) -> None:
    page = await db.get(Page, page_id)
    if page is None or page.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    # Related rows (embeddings, postings, tags, visits, …) cascade in the DB.
    await db.delete(page)
    await db.commit()


@router.get("/{page_id}/related", response_model=list[RelatedPageOut])
async def related_pages(page_id: int, user: CurrentUser, db: DbSession) -> list[RelatedPageOut]:
    page = await db.get(Page, page_id)
    if page is None or page.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    rows = await db.execute(
        select(Page.id, Page.url, Page.title, Page.site_name, RelatedPage.score)
        .join(RelatedPage, RelatedPage.related_page_id == Page.id)
        .where(RelatedPage.page_id == page_id, Page.user_id == user.id)
        .order_by(RelatedPage.score.desc())
    )
    return [
        RelatedPageOut(id=r.id, url=r.url, title=r.title, site_name=r.site_name, score=r.score)
        for r in rows
    ]


@router.post("/{page_id}/visit", status_code=status.HTTP_204_NO_CONTENT)
async def track_visit(page_id: int, user: CurrentUser, db: DbSession) -> None:
    page = await db.get(Page, page_id)
    if page is None or page.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    db.add(PageVisit(user_id=user.id, page_id=page_id))
    await db.commit()
