import asyncio
import uuid
from pathlib import Path

from httpx import AsyncClient

import app.services.pipeline as pipeline

FIXTURE = (Path(__file__).parent / "fixtures" / "sample_article.html").read_text()


def _email() -> str:
    return f"pytest{uuid.uuid4().hex}@example.com"


async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    r = await client.post(
        "/auth/register", json={"email": _email(), "password": "s3cret-password"}
    )
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _wait_for_status(
    client, page_id, headers, *, target=frozenset({"ready", "failed"})
):
    for _ in range(40):
        r = await client.get(f"/pages/{page_id}", headers=headers)
        body = r.json()
        if body["status"] in target:
            return body
        await asyncio.sleep(0.25)
    raise AssertionError(f"page {page_id} never reached {target}: {body['status']}")


async def test_save_processes_and_dedupes(client: AsyncClient, monkeypatch) -> None:
    # Avoid real network: the pipeline's fetch returns our fixture HTML.
    async def fake_fetch(url: str) -> str:
        return FIXTURE

    monkeypatch.setattr(pipeline, "fetch_html", fake_fetch)
    headers = await _auth_headers(client)

    # Save a page -> 202 accepted, status starts pending.
    r = await client.post(
        "/pages", json={"url": "https://example.com/pg-indexing"}, headers=headers
    )
    assert r.status_code == 202, r.text
    page = r.json()
    assert page["status"] in ("pending", "processing", "ready")

    # Background processing completes: extraction + summary + status ready.
    body = await _wait_for_status(client, page["id"], headers)
    assert body["status"] == "ready"
    assert body["title"] == "Understanding PostgreSQL Indexing"
    assert body["summary"]  # extractive fallback (no API key in tests)

    # Saving the same URL again dedupes to the existing page.
    r2 = await client.post(
        "/pages", json={"url": "https://example.com/pg-indexing#section"}, headers=headers
    )
    assert r2.status_code == 202
    assert r2.json()["id"] == page["id"]


async def test_get_page_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/pages/1")
    assert r.status_code in (401, 403)
