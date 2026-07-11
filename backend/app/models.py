from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    false as sa_false,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.config import settings
from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    # Google OAuth tokens (Drive read scope) — lets the pipeline export full text
    # of the user's Google Docs/Sheets/Slides. Null for password-only accounts.
    google_access_token: Mapped[str | None] = mapped_column(Text)
    google_refresh_token: Mapped[str | None] = mapped_column(Text)
    google_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(Text)
    canonical_url: Mapped[str] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    author: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    site_name: Mapped[str | None] = mapped_column(Text)
    lang: Mapped[str | None] = mapped_column(String(16))
    raw_html_ref: Mapped[str | None] = mapped_column(Text)
    # Full captured page HTML (from the extension, or server-fetched) — rendered
    # as the saved snapshot in the web app.
    snapshot_html: Mapped[str | None] = mapped_column(Text)
    clean_text: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
    # How the page entered the library: "web" (extension/app save) or "import"
    # (bulk bookmark import). Imported pages start with needs_review=True until
    # the user keeps or deletes them in the review flow.
    source: Mapped[str] = mapped_column(String(16), default="web", server_default="web")
    needs_review: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=sa_false()
    )
    is_favorite: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=sa_false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Full-text search vector, populated during ingestion.
    fts = Column(TSVECTOR, nullable=True)
    # Number of index tokens in this page (BM25 document length).
    token_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    __table_args__ = (
        UniqueConstraint("user_id", "canonical_url", name="uq_pages_user_canonical"),
    )


class PageEmbedding(Base):
    __tablename__ = "page_embeddings"

    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True
    )
    embedding = Column(Vector(settings.embedding_dim))


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_name"),)


class PageTag(Base):
    __tablename__ = "page_tags"

    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    label: Mapped[str] = mapped_column(String(64))


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CollectionPage(Base):
    __tablename__ = "collection_pages"

    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
    )
    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), index=True
    )
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PageVisit(Base):
    __tablename__ = "page_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), index=True
    )
    visited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Posting(Base):
    """Inverted index: one row per (page, term) with that term's frequency.

    This is the hand-built BM25 index — the "list of which pages contain each
    word, and how often" that keyword ranking scores against.
    """

    __tablename__ = "postings"

    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True
    )
    term: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    tf: Mapped[int] = mapped_column(Integer)


class RelatedPage(Base):
    __tablename__ = "related_pages"

    page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True
    )
    related_page_id: Mapped[int] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), primary_key=True
    )
    score: Mapped[float] = mapped_column(Float)
