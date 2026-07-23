from authlib.integrations.starlette_client import OAuth

from app.config import settings

oauth = OAuth()

# Only register the Google client once real credentials exist. Until then the
# /auth/google/* routes return 503 (see routers/auth.py).
if settings.google_configured:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        # Basic sign-in only (non-sensitive scopes) so no Google security
        # assessment is required to launch publicly. To re-enable Google Docs
        # full-text later (after verifying the app), add back
        # "https://www.googleapis.com/auth/drive.readonly" plus
        # authorize_params={"access_type": "offline", "prompt": "consent"}.
        client_kwargs={"scope": "openid email profile"},
    )
