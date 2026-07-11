"""Fetch a URL and extract its main content.

trafilatura does the heavy lifting (article text + metadata); BeautifulSoup is
a fallback so we always return *something* even on pages trafilatura can't parse.
"""
import json
from datetime import UTC, datetime
from typing import Any

import httpx
import trafilatura
from bs4 import BeautifulSoup

from app.config import settings


async def fetch_html(url: str) -> str:
    headers = {
        "User-Agent": settings.fetch_user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=settings.fetch_timeout_seconds, headers=headers
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in (None, "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.fromisoformat(value) if fmt is None else datetime.strptime(value, fmt)
        except ValueError:
            continue
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    return None


def _clean_author(author: str | None) -> str | None:
    """Drop junk that extractors mistake for an author (e.g. Wikipedia's
    'Authority control' footer, or absurdly long strings that aren't names)."""
    if not author:
        return None
    lowered = author.lower()
    if "authority control" in lowered or "edit links" in lowered or len(author) > 120:
        return None
    return author


def extract_content(url: str, html: str) -> dict[str, Any]:
    """Return title/author/site_name/lang/published_at/clean_text for a page."""
    result: dict[str, Any] = {}

    raw = trafilatura.extract(
        html, url=url, output_format="json", with_metadata=True, favor_recall=True
    )
    if raw:
        data = json.loads(raw)
        result["title"] = data.get("title")
        result["author"] = _clean_author(data.get("author"))
        result["site_name"] = data.get("sitename") or data.get("hostname")
        result["lang"] = data.get("language")
        result["published_at"] = _parse_date(data.get("date"))
        result["clean_text"] = (data.get("text") or "").strip()

    # Fallback: strip tags with BeautifulSoup if trafilatura found no body text.
    if not result.get("clean_text"):
        soup = BeautifulSoup(html, "html.parser")
        if not result.get("title") and soup.title:
            result["title"] = soup.title.get_text(strip=True)
        for tag in soup(["script", "style", "nav", "header", "footer", "noscript"]):
            tag.decompose()
        result["clean_text"] = " ".join(soup.get_text(separator=" ").split())

    result.setdefault("title", None)
    result.setdefault("author", None)
    result.setdefault("site_name", None)
    result.setdefault("lang", None)
    result.setdefault("published_at", None)
    result.setdefault("clean_text", "")
    return result
