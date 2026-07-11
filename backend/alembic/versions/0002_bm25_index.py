"""bm25 inverted index

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-05
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pages",
        sa.Column("token_count", sa.Integer, server_default="0", nullable=False),
    )
    op.create_table(
        "postings",
        sa.Column(
            "page_id",
            sa.Integer,
            sa.ForeignKey("pages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("term", sa.String(64), primary_key=True),
        sa.Column("tf", sa.Integer, nullable=False),
    )
    op.create_index("ix_postings_term", "postings", ["term"])


def downgrade() -> None:
    op.drop_table("postings")
    op.drop_column("pages", "token_count")
