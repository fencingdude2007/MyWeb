from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator

# Email addresses are case-insensitive in practice (Gmail et al.), so normalize
# to lowercase everywhere to prevent duplicate accounts like Foo@x.com vs foo@x.com.
_normalize_email = field_validator("email")(lambda cls, v: v.strip().lower())


class UserCreate(BaseModel):
    email: EmailStr
    password: str

    _norm = _normalize_email


class LoginIn(BaseModel):
    email: EmailStr
    password: str

    _norm = _normalize_email


class RefreshIn(BaseModel):
    refresh_token: str


class SetPasswordIn(BaseModel):
    password: str = Field(min_length=6)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class PageCreate(BaseModel):
    url: HttpUrl
    # Optional live-page HTML captured by the extension. If absent, the server
    # fetches the URL itself.
    html: str | None = None


class PageUpdate(BaseModel):
    """Partial update from the web app (favorite toggle, review keep)."""

    is_favorite: bool | None = None
    needs_review: bool | None = None


class ImportIn(BaseModel):
    """Bulk bookmark import from the extension."""

    urls: list[HttpUrl] = Field(max_length=500)


class ImportOut(BaseModel):
    created: int
    skipped: int


class SearchSignals(BaseModel):
    semantic: float
    keyword: float
    trigram: float
    recency: float
    favorite: float = 0.0


class SearchResult(BaseModel):
    id: int
    url: str
    title: str | None
    summary: str | None
    site_name: str | None
    created_at: datetime
    snippet: str
    score: float
    signals: SearchSignals


class SearchResponse(BaseModel):
    query: str
    count: int
    results: list[SearchResult]


class PageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    canonical_url: str
    title: str | None
    author: str | None
    site_name: str | None
    summary: str | None
    status: str
    source: str
    needs_review: bool
    is_favorite: bool
    created_at: datetime
    published_at: datetime | None
    fetched_at: datetime | None


class PageDetail(PageOut):
    """Full page view. `snapshot` is the saved page HTML shown in the web app;
    `content` is the extracted text (kept for reference, not normally displayed)."""

    snapshot: str | None = None
    content: str | None = None


# --- organization (collections / notes / tags) ------------------------------


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class CollectionFromUrls(BaseModel):
    """Create (or reuse, by name) a collection and drop a batch of URLs into it.

    Powers the extension's "Sweep & close" (a dated Session) and "Park it"
    (a shared "Later" list). Pages already saved are just linked, not re-fetched.
    """

    name: str = Field(min_length=1, max_length=255)
    urls: list[HttpUrl] = Field(max_length=500)


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    page_count: int = 0


class NoteCreate(BaseModel):
    body: str = Field(min_length=1)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    page_id: int
    body: str
    created_at: datetime


class TagOut(BaseModel):
    id: int
    name: str
    page_count: int


class RelatedPageOut(BaseModel):
    id: int
    url: str
    title: str | None
    site_name: str | None
    score: float


# --- suggestions / ask / stats ----------------------------------------------


class SuggestionOut(BaseModel):
    """A site scraped from the web that fits a collection's theme."""

    title: str
    url: str
    snippet: str


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class AskSource(BaseModel):
    id: int
    url: str
    title: str | None
    site_name: str | None


class AskOut(BaseModel):
    question: str
    answer: str
    sources: list[AskSource]


class SynthesisOut(BaseModel):
    """A cited brief that pulls the through-line across a whole collection."""

    summary: str
    sources: list[AskSource]


class DayCount(BaseModel):
    day: str  # YYYY-MM-DD
    count: int


class NameCount(BaseModel):
    name: str
    count: int


class StatsOut(BaseModel):
    total_pages: int
    ready_pages: int
    favorite_pages: int
    total_collections: int
    total_notes: int
    saves_per_day: list[DayCount]  # last 30 days
    top_tags: list[NameCount]
    top_sites: list[NameCount]
