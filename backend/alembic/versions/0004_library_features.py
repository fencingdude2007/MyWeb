"""library features: favorites, import review, Google Drive tokens

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-05
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pages",
        sa.Column("source", sa.String(16), nullable=False, server_default="web"),
    )
    op.add_column(
        "pages",
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "pages",
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("users", sa.Column("google_access_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("google_refresh_token", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("google_token_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "google_token_expires_at")
    op.drop_column("users", "google_refresh_token")
    op.drop_column("users", "google_access_token")
    op.drop_column("pages", "is_favorite")
    op.drop_column("pages", "needs_review")
    op.drop_column("pages", "source")
