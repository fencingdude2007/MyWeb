"""YouTube handling: detect video URLs, fetch metadata (oEmbed) and transcript.

Videos aren't articles — the real content is the spoken transcript, which is
what we index for search and feed to the summarizer.
"""
import re
from typing import Any

import httpx

# Matches the 11-char video id in watch, youtu.be, embed, and shorts URLs.
_VIDEO_ID_RE = re.compile(r"(?:v=|/embed/|youtu\.be/|/shorts/)([A-Za-z0-9_-]{11})")


def extract_video_id(url: str) -> str | None:
    match = _VIDEO_ID_RE.search(url)
    return match.group(1) if match else None


def is_youtube(url: str) -> bool:
    return ("youtube.com" in url or "youtu.be" in url) and extract_video_id(url) is not None


async def fetch_oembed(url: str) -> dict[str, Any]:
    """Title, channel and thumbnail via YouTube's oEmbed endpoint (no API key)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://www.youtube.com/oembed", params={"url": url, "format": "json"}
        )
        resp.raise_for_status()
        return resp.json()


def fetch_transcript(video_id: str) -> str:
    """Best-effort transcript text. Empty string if captions are unavailable."""
    if not video_id:
        return ""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return ""

    # Support both the 0.6.x classmethod API and the 1.x instance API.
    try:
        chunks = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US"])
        return " ".join(c["text"] for c in chunks).strip()
    except Exception:
        pass
    try:
        fetched = YouTubeTranscriptApi().fetch(video_id)
        return " ".join(snippet.text for snippet in fetched).strip()
    except Exception:
        return ""
