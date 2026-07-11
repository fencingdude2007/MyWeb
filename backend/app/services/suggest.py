"""Suggested sites for a collection, scraped from the web (free, no API key).

Builds a search query from the collection's name + its pages' titles/tags, then
scrapes DuckDuckGo's HTML endpoint and returns results the user hasn't saved yet.
"""
import logging
from collections import Counter
from urllib.parse import parse_qs, unquote, urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import settings

logger = logging.getLogger("myweb.suggest")

_DDG_URL = "https://html.duckduckgo.com/html/"


def build_query(collection_name: str, titles: list[str], tags: list[str]) -> str:
    """Collection name + the most common tags across its pages."""
    parts = [collection_name]
    parts.extend(name for name, _ in Counter(tags).most_common(3))
    if not tags and titles:
        # No tags yet — fall back to the first page title's leading words.
        parts.append(" ".join(titles[0].split()[:6]))
    return " ".join(dict.fromkeys(parts))  # dedupe, keep order


def _unwrap_ddg_url(href: str) -> str | None:
    """DuckDuckGo wraps results as //duckduckgo.com/l/?uddg=<encoded-url>."""
    if href.startswith("//"):
        href = "https:" + href
    parsed = urlparse(href)
    if "duckduckgo.com" in (parsed.hostname or "") and parsed.path.startswith("/l/"):
        target = parse_qs(parsed.query).get("uddg", [None])[0]
        return unquote(target) if target else None
    if parsed.scheme in ("http", "https"):
        return href
    return None


def parse_results(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, str]] = []
    for result in soup.select(".result"):
        link = result.select_one("a.result__a")
        if link is None:
            continue
        url = _unwrap_ddg_url(link.get("href") or "")
        if not url:
            continue
        snippet_el = result.select_one(".result__snippet")
        results.append(
            {
                "title": link.get_text(strip=True),
                "url": url,
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
            }
        )
    return results


async def suggest_sites(query: str, exclude_urls: set[str], limit: int = 8) -> list[dict[str, str]]:
    try:
        async with httpx.AsyncClient(
            timeout=settings.fetch_timeout_seconds,
            headers={"User-Agent": settings.fetch_user_agent},
            follow_redirects=True,
        ) as client:
            resp = await client.post(_DDG_URL, data={"q": query})
            resp.raise_for_status()
    except httpx.HTTPError:
        logger.warning("Suggestion scrape failed for query %r", query)
        return []

    def _canonical(u: str) -> str:
        return u.split("#")[0].rstrip("/")

    excluded = {_canonical(u) for u in exclude_urls}
    out: list[dict[str, str]] = []
    for r in parse_results(resp.text):
        if _canonical(r["url"]) in excluded:
            continue
        out.append(r)
        if len(out) >= limit:
            break
    return out
