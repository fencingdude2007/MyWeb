from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import SearchResponse
from app.services.search import hybrid_search

router = APIRouter(tags=["search"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/search", response_model=SearchResponse)
async def search(
    user: CurrentUser,
    db: DbSession,
    q: str = Query("", description="Natural-language query"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> SearchResponse:
    results = await hybrid_search(db, user.id, q, limit, offset)
    return SearchResponse(query=q, count=len(results), results=results)
