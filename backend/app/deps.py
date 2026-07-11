from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.security import decode_token

bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError as exc:
        raise cred_exc from exc

    if payload.get("type") != "access":
        raise cred_exc
    sub = payload.get("sub")
    if sub is None:
        raise cred_exc

    user = await db.get(User, int(sub))
    if user is None:
        raise cred_exc
    return user
