"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-04
"""
from collections.abc import Sequence

import pgvector.sqlalchemy
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMBEDDING_DIM = 384


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("google_sub", sa.String(255)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)

    op.create_table(
        "pages",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("canonical_url", sa.Text, nullable=False),
        sa.Column("title", sa.Text),
        sa.Column("author", sa.Text),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("site_name", sa.Text),
        sa.Column("lang", sa.String(16)),
        sa.Column("raw_html_ref", sa.Text),
        sa.Column("clean_text", sa.Text),
        sa.Column("summary", sa.Text),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("fetched_at", sa.DateTime(timezone=True)),
        sa.Column("fts", postgresql.TSVECTOR()),
        sa.UniqueConstraint("user_id", "canonical_url", name="uq_pages_user_canonical"),
    )
    op.create_index("ix_pages_user_id", "pages", ["user_id"])
    op.execute("CREATE INDEX ix_pages_fts ON pages USING gin (fts)")
    op.execute("CREATE INDEX ix_pages_title_trgm ON pages USING gin (title gin_trgm_ops)")

    op.create_table(
        "page_embeddings",
        sa.Column(
            "page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(EMBEDDING_DIM)),
    )
    op.execute(
        "CREATE INDEX ix_page_embeddings_hnsw ON page_embeddings "
        "USING hnsw (embedding vector_cosine_ops)"
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(128), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )

    op.create_table(
        "page_tags",
        sa.Column(
            "page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            sa.Integer,
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    op.create_table(
        "entities",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
    )
    op.create_index("ix_entities_page_id", "entities", ["page_id"])

    op.create_table(
        "collections",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_collections_user_id", "collections", ["user_id"])

    op.create_table(
        "collection_pages",
        sa.Column(
            "collection_id",
            sa.Integer,
            sa.ForeignKey("collections.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "notes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_notes_page_id", "notes", ["page_id"])

    op.create_table(
        "page_visits",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "visited_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_page_visits_user_id", "page_visits", ["user_id"])
    op.create_index("ix_page_visits_page_id", "page_visits", ["page_id"])

    op.create_table(
        "related_pages",
        sa.Column(
            "page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "related_page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("score", sa.Float, nullable=False),
    )


def downgrade() -> None:
    for table in (
        "related_pages",
        "page_visits",
        "notes",
        "collection_pages",
        "collections",
        "entities",
        "page_tags",
        "tags",
        "page_embeddings",
        "pages",
        "users",
    ):
        op.drop_table(table)
