"""Google Workspace detection (Docs / Sheets / Slides).

Display is via the embeddable /preview URL (the frontend). Full-text extraction
of private files needs the Drive API + an extra OAuth scope — a later step.
"""
import re

_GOOGLE_RE = re.compile(
    r"docs\.google\.com/(document|spreadsheets|presentation)/d/([A-Za-z0-9_-]+)"
)

_SITE_NAMES = {
    "document": "Google Docs",
    "spreadsheets": "Google Sheets",
    "presentation": "Google Slides",
}


def google_match(url: str) -> tuple[str, str] | None:
    """Return (kind, file_id) for a Google Workspace URL, else None."""
    m = _GOOGLE_RE.search(url)
    return (m.group(1), m.group(2)) if m else None


def is_google_workspace(url: str) -> bool:
    return google_match(url) is not None


def google_site_name(url: str) -> str | None:
    match = google_match(url)
    return _SITE_NAMES.get(match[0]) if match else None
