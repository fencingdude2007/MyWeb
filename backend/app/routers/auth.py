from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlparse

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.oauth import oauth
from app.schemas import (
    AccessToken,
    LoginIn,
    RefreshIn,
    SetPasswordIn,
    TokenPair,
    UserCreate,
    UserOut,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

DbSession = Annotated[AsyncSession, Depends(get_db)]


def _tokens_for(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: DbSession) -> TokenPair:
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    user = User(email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _tokens_for(user)


@router.post("/login", response_model=TokenPair)
async def login(data: LoginIn, db: DbSession) -> TokenPair:
    user = await db.scalar(select(User).where(User.email == data.email))
    if (
        user is None
        or user.password_hash is None
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return _tokens_for(user)


@router.post("/refresh", response_model=AccessToken)
async def refresh(data: RefreshIn) -> AccessToken:
    invalid = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    try:
        payload = decode_token(data.refresh_token)
    except jwt.PyJWTError as exc:
        raise invalid from exc
    if payload.get("type") != "refresh" or payload.get("sub") is None:
        raise invalid
    return AccessToken(access_token=create_access_token(payload["sub"]))


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[User, Depends(get_current_user)]) -> User:
    return user


@router.post("/set-password", status_code=status.HTTP_204_NO_CONTENT)
async def set_password(
    data: SetPasswordIn,
    user: Annotated[User, Depends(get_current_user)],
    db: DbSession,
) -> None:
    """Set/replace the current user's password.

    Lets a Google-signed-in account create a password so it can also log in via
    the Chrome extension (which uses email + password).
    """
    user.password_hash = hash_password(data.password)
    await db.commit()


def _valid_ext_redirect(url: str | None) -> str | None:
    """Only allow the Chrome extension's own https://<id>.chromiumapp.org/ URL."""
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme == "https" and (parsed.hostname or "").endswith(".chromiumapp.org"):
        return url
    return None


@router.get("/google/login")
async def google_login(request: Request, ext_redirect: str | None = None) -> RedirectResponse:
    if not settings.google_configured:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth is not configured"
        )
    # If the Chrome extension started this flow, remember where to send tokens.
    valid = _valid_ext_redirect(ext_redirect)
    if valid:
        request.session["ext_redirect"] = valid
    else:
        request.session.pop("ext_redirect", None)
    return await oauth.google.authorize_redirect(request, settings.google_redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: DbSession) -> RedirectResponse:
    if not settings.google_configured:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth is not configured"
        )
    token = await oauth.google.authorize_access_token(request)
    info = token.get("userinfo") or {}
    sub, email = info.get("sub"), info.get("email")
    if not sub or not email:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Google did not return an account"
        )

    user = await db.scalar(select(User).where(User.google_sub == sub))
    if user is None:
        # Link Google to an existing email account, or create a new one.
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, google_sub=sub)
            db.add(user)
        else:
            user.google_sub = sub

    # Keep Google's tokens so the pipeline can export Drive files' full text.
    user.google_access_token = token.get("access_token")
    if token.get("refresh_token"):  # only sent on first consent / prompt=consent
        user.google_refresh_token = token["refresh_token"]
    if token.get("expires_in"):
        user.google_token_expires_at = datetime.now(UTC) + timedelta(
            seconds=int(token["expires_in"])
        )
    await db.commit()
    await db.refresh(user)

    pair = _tokens_for(user)
    fragment = f"#access_token={pair.access_token}&refresh_token={pair.refresh_token}"

    # Chrome extension flow redirects to its chromiumapp.org URL; web app otherwise.
    ext_redirect = request.session.pop("ext_redirect", None)
    if ext_redirect:
        return RedirectResponse(f"{ext_redirect}{fragment}")
    return RedirectResponse(f"{settings.frontend_url}/auth/callback{fragment}")
