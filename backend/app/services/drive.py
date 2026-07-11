"""Google Drive full-text extraction for Docs / Sheets / Slides.

Uses the user's stored OAuth tokens (drive.readonly scope) to `files.export`
the document as plain text. The Drive API itself is free. Falls back silently
when the user has no Drive token (password-only login, or pre-scope sign-in).
"""
import logging
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import User

logger = logging.getLogger("myweb.drive")

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_EXPORT_URL = "https://www.googleapis.com/drive/v3/files/{file_id}/export"

# What each Google editor kind exports cleanest as.
_EXPORT_MIME = {
    "document": "text/plain",
    "spreadsheets": "text/csv",
    "presentation": "text/plain",
}


async def _refresh_access_token(user: User, db: AsyncSession) -> str | None:
    if not (user.google_refresh_token and settings.google_configured):
        return None
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": user.google_refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if resp.status_code != 200:
        logger.warning("Google token refresh failed for user %s: %s", user.id, resp.text)
        return None
    data = resp.json()
    user.google_access_token = data["access_token"]
    user.google_token_expires_at = datetime.now(UTC) + timedelta(
        seconds=int(data.get("expires_in", 3600))
    )
    await db.commit()
    return user.google_access_token


async def _valid_access_token(user: User, db: AsyncSession) -> str | None:
    if user.google_access_token and user.google_token_expires_at:
        # 60s of slack so we don't use a token that dies mid-request.
        if user.google_token_expires_at > datetime.now(UTC) + timedelta(seconds=60):
            return user.google_access_token
    return await _refresh_access_token(user, db)


async def fetch_drive_text(
    user: User, kind: str, file_id: str, db: AsyncSession
) -> str | None:
    """Export a Google file's text via the Drive API, or None if unavailable
    (no token, no permission, unsupported kind)."""
    mime = _EXPORT_MIME.get(kind)
    if mime is None:
        return None
    token = await _valid_access_token(user, db)
    if token is None:
        return None

    async with httpx.AsyncClient(timeout=settings.fetch_timeout_seconds) as client:
        resp = await client.get(
            _EXPORT_URL.format(file_id=file_id),
            params={"mimeType": mime},
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        logger.info(
            "Drive export failed (%s) for file %s user %s", resp.status_code, file_id, user.id
        )
        return None
    text = resp.text.strip()
    return text or None
