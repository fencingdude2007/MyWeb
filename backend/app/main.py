import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.routers import ask, auth, collections, notes, pages, search, stats, tags

app = FastAPI(title=f"{settings.app_name} API", version="0.1.0")

# Loud guard: shipping the dev JWT secret to a public server would let anyone
# mint valid tokens. (A warning, not a crash, so local dev keeps working.)
if settings.jwt_secret == "dev-secret-change-me":
    logging.getLogger("uvicorn.error").warning(
        "SECURITY: jwt_secret is the dev default. Set a strong JWT_SECRET in "
        "backend/.env before exposing this server publicly."
    )

# SessionMiddleware stores the short-lived OAuth state during the Google flow.
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(pages.router)
app.include_router(search.router)
app.include_router(collections.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(ask.router)
app.include_router(stats.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "myweb-api", "version": app.version}
