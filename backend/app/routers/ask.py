from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.ratelimit import check_rate_limit
from app.schemas import AskIn, AskOut
from app.services.ask import ask_pages

router = APIRouter(tags=["ask"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post("/ask", response_model=AskOut)
async def ask(data: AskIn, user: CurrentUser, db: DbSession) -> AskOut:
    check_rate_limit(user.id, "ask", limit=20, window_seconds=60)
    result = await ask_pages(db, user.id, data.question)
    return AskOut(**result)
