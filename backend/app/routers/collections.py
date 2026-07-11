from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import Collection, CollectionPage, Page, PageTag, Tag, User
from app.ratelimit import check_rate_limit
from app.schemas import CollectionCreate, CollectionOut, PageOut, SuggestionOut
from app.services.suggest import build_query, suggest_sites

router = APIRouter(prefix="/collections", tags=["collections"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _get_owned(collection_id: int, user: User, db: AsyncSession) -> Collection:
    coll = await db.get(Collection, collection_id)
    if coll is None or coll.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collection not found")
    return coll


def _out(coll: Collection, page_count: int) -> CollectionOut:
    return CollectionOut(
        id=coll.id, name=coll.name, created_at=coll.created_at, page_count=page_count
    )


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
async def create_collection(
    data: CollectionCreate, user: CurrentUser, db: DbSession
) -> CollectionOut:
    coll = Collection(user_id=user.id, name=data.name)
    db.add(coll)
    await db.commit()
    await db.refresh(coll)
    return _out(coll, 0)


@router.get("", response_model=list[CollectionOut])
async def list_collections(user: CurrentUser, db: DbSession) -> list[CollectionOut]:
    rows = await db.execute(
        select(Collection, func.count(CollectionPage.page_id))
        .outerjoin(CollectionPage, CollectionPage.collection_id == Collection.id)
        .where(Collection.user_id == user.id)
        .group_by(Collection.id)
        .order_by(Collection.created_at.desc())
    )
    return [_out(coll, count) for coll, count in rows]


@router.get("/{collection_id}", response_model=CollectionOut)
async def get_collection(collection_id: int, user: CurrentUser, db: DbSession) -> CollectionOut:
    coll = await _get_owned(collection_id, user, db)
    count = await db.scalar(
        select(func.count()).where(CollectionPage.collection_id == collection_id)
    )
    return _out(coll, count or 0)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(collection_id: int, user: CurrentUser, db: DbSession) -> None:
    coll = await _get_owned(collection_id, user, db)
    await db.delete(coll)
    await db.commit()


@router.get("/{collection_id}/pages", response_model=list[PageOut])
async def collection_pages(
    collection_id: int, user: CurrentUser, db: DbSession
) -> list[Page]:
    await _get_owned(collection_id, user, db)
    rows = await db.scalars(
        select(Page)
        .join(CollectionPage, CollectionPage.page_id == Page.id)
        .where(CollectionPage.collection_id == collection_id)
        .order_by(CollectionPage.added_at.desc())
    )
    return list(rows)


@router.put("/{collection_id}/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_page(
    collection_id: int, page_id: int, user: CurrentUser, db: DbSession
) -> None:
    await _get_owned(collection_id, user, db)
    page = await db.get(Page, page_id)
    if page is None or page.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    existing = await db.get(CollectionPage, (collection_id, page_id))
    if existing is None:
        db.add(CollectionPage(collection_id=collection_id, page_id=page_id))
        await db.commit()


@router.delete("/{collection_id}/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_page(
    collection_id: int, page_id: int, user: CurrentUser, db: DbSession
) -> None:
    await _get_owned(collection_id, user, db)
    await db.execute(
        delete(CollectionPage).where(
            CollectionPage.collection_id == collection_id,
            CollectionPage.page_id == page_id,
        )
    )
    await db.commit()


@router.get("/{collection_id}/suggestions", response_model=list[SuggestionOut])
async def collection_suggestions(
    collection_id: int, user: CurrentUser, db: DbSession
) -> list[SuggestionOut]:
    """Scrape the web for sites that fit this collection's theme (name + tags
    of its pages), excluding anything the user already saved."""
    check_rate_limit(user.id, "suggest", limit=10, window_seconds=60)
    coll = await _get_owned(collection_id, user, db)

    titles = list(
        await db.scalars(
            select(Page.title)
            .join(CollectionPage, CollectionPage.page_id == Page.id)
            .where(CollectionPage.collection_id == collection_id, Page.title.is_not(None))
            .limit(20)
        )
    )
    tags = list(
        await db.scalars(
            select(Tag.name)
            .join(PageTag, PageTag.tag_id == Tag.id)
            .join(CollectionPage, CollectionPage.page_id == PageTag.page_id)
            .where(CollectionPage.collection_id == collection_id)
        )
    )
    saved_urls = set(
        await db.scalars(select(Page.canonical_url).where(Page.user_id == user.id))
    )

    query = build_query(coll.name, titles, tags)
    results = await suggest_sites(query, exclude_urls=saved_urls)
    return [SuggestionOut(**r) for r in results]
