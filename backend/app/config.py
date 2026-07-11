from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env — resolved absolutely so the app works from any working dir.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")

    app_name: str = "MyWeb AI"

    # Database (Neon in prod/dev). The raw URL may include ?sslmode=... — app.db
    # normalizes the driver and SSL, so you can paste Neon's string verbatim.
    database_url: str = "postgresql+asyncpg://myweb:myweb@localhost:5432/myweb"

    # AI / embeddings — keep the dimension here; changing it means re-embedding.
    embedding_dim: int = 384

    # Summarization (Anthropic Claude). Empty key -> extractive fallback.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5"
    summary_max_tokens: int = 512

    # Page fetching — use a browser-like UA; many sites 403 obvious bots.
    fetch_user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    fetch_timeout_seconds: float = 20.0

    # Hybrid search ranking weights (tune freely).
    search_w_semantic: float = 1.0
    search_w_keyword: float = 1.0
    search_w_trigram: float = 0.4
    search_w_recency: float = 0.15
    search_w_favorite: float = 0.2

    # Related-pages precompute: how many nearest neighbors to store per page.
    related_pages_top_n: int = 5

    # RAG "ask your pages": how many pages feed the answer context.
    ask_top_k: int = 6

    # Auth
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    # Google OAuth (empty until you add credentials — routes 503 until then).
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    frontend_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173"]

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def anthropic_configured(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
