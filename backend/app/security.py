from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _create_token(sub: str, token_type: str, expires: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {"sub": sub, "type": token_type, "iat": now, "exp": now + expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(sub: str) -> str:
    return _create_token(
        sub, "access", timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(sub: str) -> str:
    return _create_token(
        sub, "refresh", timedelta(days=settings.refresh_token_expire_days)
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
