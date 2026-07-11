from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import Note, Page, User
from app.schemas import NoteCreate, NoteOut

router = APIRouter(tags=["notes"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _owned_page(page_id: int, user: User, db: AsyncSession) -> Page:
    page = await db.get(Page, page_id)
    if page is None or page.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    return page


@router.get("/pages/{page_id}/notes", response_model=list[NoteOut])
async def list_notes(page_id: int, user: CurrentUser, db: DbSession) -> list[Note]:
    await _owned_page(page_id, user, db)
    rows = await db.scalars(
        select(Note).where(Note.page_id == page_id).order_by(Note.created_at.desc())
    )
    return list(rows)


@router.post(
    "/pages/{page_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED
)
async def create_note(
    page_id: int, data: NoteCreate, user: CurrentUser, db: DbSession
) -> Note:
    await _owned_page(page_id, user, db)
    note = Note(user_id=user.id, page_id=page_id, body=data.body)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: int, user: CurrentUser, db: DbSession) -> None:
    note = await db.get(Note, note_id)
    if note is None or note.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    await db.delete(note)
    await db.commit()
