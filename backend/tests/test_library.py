"""Tests for library management: favorites, review flow, bulk import,
collections, and notes."""
import uuid

from httpx import AsyncClient

import app.routers.pages as pages_router


def _email() -> str:
    return f"pytest{uuid.uuid4().hex}@example.com"


async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    r = await client.post(
        "/auth/register", json={"email": _email(), "password": "s3cret-password"}
    )
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _save_page(client, headers, url="https://example.com/a") -> dict:
    r = await client.post("/pages", json={"url": url}, headers=headers)
    assert r.status_code == 202, r.text
    return r.json()


async def test_favorite_toggle_and_filter(client: AsyncClient, monkeypatch) -> None:
    async def noop(page_id: int) -> None:
        return None

    monkeypatch.setattr(pages_router, "process_page", noop)
    headers = await _auth_headers(client)
    page = await _save_page(client, headers)

    r = await client.patch(
        f"/pages/{page['id']}", json={"is_favorite": True}, headers=headers
    )
    assert r.status_code == 200
    assert r.json()["is_favorite"] is True

    r = await client.get("/pages", params={"favorites": True}, headers=headers)
    assert [p["id"] for p in r.json()] == [page["id"]]


async def test_import_dedupes_and_flags_review(client: AsyncClient, monkeypatch) -> None:
    async def noop(page_ids) -> None:
        return None

    monkeypatch.setattr(pages_router, "_process_sequentially", noop)
    headers = await _auth_headers(client)
    existing = await _save_page(client, headers, "https://example.com/already-saved")
    assert existing["needs_review"] is False

    r = await client.post(
        "/pages/import",
        json={"urls": ["https://example.com/already-saved", "https://example.com/new"]},
        headers=headers,
    )
    assert r.status_code == 202, r.text
    assert r.json() == {"created": 1, "skipped": 1}

    r = await client.get("/pages", params={"needs_review": True}, headers=headers)
    review = r.json()
    assert len(review) == 1
    assert review[0]["source"] == "import"

    # Keep: clear the review flag.
    r = await client.patch(
        f"/pages/{review[0]['id']}", json={"needs_review": False}, headers=headers
    )
    assert r.status_code == 200
    r = await client.get("/pages", params={"needs_review": True}, headers=headers)
    assert r.json() == []


async def test_collections_crud_and_membership(client: AsyncClient, monkeypatch) -> None:
    async def noop(page_id: int) -> None:
        return None

    monkeypatch.setattr(pages_router, "process_page", noop)
    headers = await _auth_headers(client)
    page = await _save_page(client, headers)

    r = await client.post("/collections", json={"name": "Reading"}, headers=headers)
    assert r.status_code == 201
    coll = r.json()

    r = await client.put(f"/collections/{coll['id']}/pages/{page['id']}", headers=headers)
    assert r.status_code == 204

    r = await client.get(f"/collections/{coll['id']}/pages", headers=headers)
    assert [p["id"] for p in r.json()] == [page["id"]]

    r = await client.get("/collections", headers=headers)
    assert r.json()[0]["page_count"] == 1

    r = await client.delete(
        f"/collections/{coll['id']}/pages/{page['id']}", headers=headers
    )
    assert r.status_code == 204
    r = await client.get(f"/collections/{coll['id']}/pages", headers=headers)
    assert r.json() == []


async def test_notes_crud(client: AsyncClient, monkeypatch) -> None:
    async def noop(page_id: int) -> None:
        return None

    monkeypatch.setattr(pages_router, "process_page", noop)
    headers = await _auth_headers(client)
    page = await _save_page(client, headers)

    r = await client.post(
        f"/pages/{page['id']}/notes", json={"body": "great explanation"}, headers=headers
    )
    assert r.status_code == 201
    note = r.json()

    r = await client.get(f"/pages/{page['id']}/notes", headers=headers)
    assert [n["id"] for n in r.json()] == [note["id"]]

    r = await client.delete(f"/notes/{note['id']}", headers=headers)
    assert r.status_code == 204
    r = await client.get(f"/pages/{page['id']}/notes", headers=headers)
    assert r.json() == []


async def test_stats_and_export(client: AsyncClient, monkeypatch) -> None:
    async def noop(page_id: int) -> None:
        return None

    monkeypatch.setattr(pages_router, "process_page", noop)
    headers = await _auth_headers(client)
    await _save_page(client, headers)

    r = await client.get("/stats", headers=headers)
    assert r.status_code == 200
    assert r.json()["total_pages"] == 1

    r = await client.get("/export", headers=headers)
    assert r.status_code == 200
    assert len(r.json()["pages"]) == 1
