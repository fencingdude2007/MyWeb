import uuid

from httpx import AsyncClient


def _email() -> str:
    return f"pytest{uuid.uuid4().hex}@example.com"


async def test_register_login_me_refresh(client: AsyncClient) -> None:
    email, password = _email(), "s3cret-password"

    # register -> returns a token pair
    r = await client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    tokens = r.json()
    assert tokens["access_token"] and tokens["refresh_token"]

    # duplicate registration is rejected
    r = await client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 400

    # login with correct credentials
    r = await client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    access, refresh = r.json()["access_token"], r.json()["refresh_token"]

    # login with wrong password is rejected
    r = await client.post("/auth/login", json={"email": email, "password": "nope"})
    assert r.status_code == 401

    # /me returns the current user
    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert r.json()["email"] == email

    # /me without a token is rejected
    r = await client.get("/auth/me")
    assert r.status_code in (401, 403)

    # refresh yields a new access token
    r = await client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    assert r.json()["access_token"]

    # an access token cannot be used as a refresh token
    r = await client.post("/auth/refresh", json={"refresh_token": access})
    assert r.status_code == 401


async def test_google_login_route(client: AsyncClient) -> None:
    # 503 when Google isn't configured; 302 -> Google when credentials are set.
    from app.config import settings

    r = await client.get("/auth/google/login", follow_redirects=False)
    if settings.google_configured:
        assert r.status_code == 302
        assert "accounts.google.com" in r.headers["location"]
    else:
        assert r.status_code == 503
