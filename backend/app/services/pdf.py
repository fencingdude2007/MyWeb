"""PDF handling: detect PDF URLs, download, and extract text for search."""
from io import BytesIO
from typing import Any
from urllib.parse import urlparse

import httpx
from pypdf import PdfReader

from app.config import settings


def is_pdf_url(url: str) -> bool:
    return urlparse(url).path.lower().endswith(".pdf")


async def fetch_pdf_bytes(url: str) -> bytes:
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=settings.fetch_timeout_seconds,
        headers={"User-Agent": settings.fetch_user_agent},
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


def extract_pdf_text(data: bytes) -> dict[str, Any]:
    reader = PdfReader(BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            continue
    text = " ".join(" ".join(parts).split())

    title = None
    try:
        if reader.metadata and reader.metadata.title:
            title = reader.metadata.title
    except Exception:
        pass
    # Fall back to the first non-empty line of the document (often the title).
    if not title and parts:
        first_line = next((ln.strip() for ln in parts[0].splitlines() if ln.strip()), "")
        title = first_line[:160] or None
    return {"title": title, "text": text}
