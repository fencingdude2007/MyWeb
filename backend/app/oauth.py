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
        # drive.readonly lets the pipeline export full text of the user's
        # Google Docs/Sheets/Slides. access_type=offline + prompt=consent make
        # Google return a refresh token so Drive access survives token expiry.
        client_kwargs={
            "scope": "openid email profile https://www.googleapis.com/auth/drive.readonly",
        },
        authorize_params={"access_type": "offline", "prompt": "consent"},
    )
