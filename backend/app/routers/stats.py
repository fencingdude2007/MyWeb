from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import Collection, Note, Page, PageTag, Tag, User
from app.schemas import DayCount, NameCount, StatsOut

router = APIRouter(tags=["stats"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

_SAVES_PER_DAY_SQL = text(
    """
    SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day, count(*) AS count
    FROM pages
    WHERE user_id = :uid AND created_at >= now() - interval '30 days'
    GROUP BY created_at::date
    ORDER BY created_at::date
    """
)


@router.get("/stats", response_model=StatsOut)
async def stats(user: CurrentUser, db: DbSession) -> StatsOut:
    total = await db.scalar(select(func.count()).where(Page.user_id == user.id)) or 0
    ready = (
        await db.scalar(
            select(func.count()).where(Page.user_id == user.id, Page.status == "ready")
        )
        or 0
    )
    favorites = (
        await db.scalar(
            select(func.count()).where(Page.user_id == user.id, Page.is_favorite.is_(True))
        )
        or 0
    )
    collections = (
        await db.scalar(select(func.count()).where(Collection.user_id == user.id)) or 0
    )
    notes = await db.scalar(select(func.count()).where(Note.user_id == user.id)) or 0

    per_day = await db.execute(_SAVES_PER_DAY_SQL, {"uid": user.id})
    top_tags = await db.execute(
        select(Tag.name, func.count(PageTag.page_id).label("count"))
        .join(PageTag, PageTag.tag_id == Tag.id)
        .where(Tag.user_id == user.id)
        .group_by(Tag.name)
        .order_by(func.count(PageTag.page_id).desc())
        .limit(10)
    )
    top_sites = await db.execute(
        select(Page.site_name, func.count().label("count"))
        .where(Page.user_id == user.id, Page.site_name.is_not(None))
        .group_by(Page.site_name)
        .order_by(func.count().desc())
        .limit(10)
    )

    return StatsOut(
        total_pages=total,
        ready_pages=ready,
        favorite_pages=favorites,
        total_collections=collections,
        total_notes=notes,
        saves_per_day=[DayCount(day=r.day, count=r.count) for r in per_day],
        top_tags=[NameCount(name=r.name, count=r.count) for r in top_tags],
        top_sites=[NameCount(name=r.site_name, count=r.count) for r in top_sites],
    )


@router.get("/export")
async def export_data(user: CurrentUser, db: DbSession) -> dict[str, Any]:
    """Full JSON export of the user's library (own-your-data)."""
    pages = await db.scalars(
        select(Page).where(Page.user_id == user.id).order_by(Page.created_at)
    )
    notes = await db.scalars(select(Note).where(Note.user_id == user.id))
    collections = await db.scalars(select(Collection).where(Collection.user_id == user.id))

    return {
        "email": user.email,
        "pages": [
            {
                "id": p.id,
                "url": p.url,
                "title": p.title,
                "summary": p.summary,
                "site_name": p.site_name,
                "is_favorite": p.is_favorite,
                "source": p.source,
                "created_at": p.created_at.isoformat(),
                "clean_text": p.clean_text,
            }
            for p in pages
        ],
        "notes": [
            {"page_id": n.page_id, "body": n.body, "created_at": n.created_at.isoformat()}
            for n in notes
        ],
        "collections": [{"id": c.id, "name": c.name} for c in collections],
    }
