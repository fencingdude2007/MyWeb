from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import PageTag, Tag, User
from app.schemas import TagOut
from app.services.enrich import _STOPWORDS

router = APIRouter(prefix="/tags", tags=["tags"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _is_junk(name: str) -> bool:
    """Vague single words ("you", "this", "things") that older extraction let
    through — hide them so the Library only shows specific, useful tags."""
    return len(name) < 3 or name in _STOPWORDS


@router.get("", response_model=list[TagOut])
async def list_tags(user: CurrentUser, db: DbSession, limit: int = 100) -> list[TagOut]:
    rows = await db.execute(
        select(Tag.id, Tag.name, func.count(PageTag.page_id).label("page_count"))
        .outerjoin(PageTag, PageTag.tag_id == Tag.id)
        .where(Tag.user_id == user.id)
        .group_by(Tag.id)
        .order_by(func.count(PageTag.page_id).desc(), Tag.name)
        .limit(min(limit, 500))
    )
    return [
        TagOut(id=r.id, name=r.name, page_count=r.page_count)
        for r in rows
        if not _is_junk(r.name)
    ]
