import base64
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from PIL import Image
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import ensure_schema, get_session
from app.storage import get_storage, public_asset_url


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_schema()
    from app.seed import seed
    await seed()
    yield


app = FastAPI(title="Peblo TV Mini API", version="1.0.0", lifespan=lifespan)
local_storage_path = Path(os.getenv("LOCAL_STORAGE_PATH", "/tmp/peblo"))
local_storage_path.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(local_storage_path)), name="static")


class ShowInput(BaseModel):
    title: str = Field(min_length=1)
    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    section: str | None = None
    categories: list[str] = []
    synopsis: str = ""
    status: Literal["draft", "published"] = "draft"


class SeasonInput(BaseModel):
    show_id: int
    number: int = Field(ge=0)
    title: str | None = None


class EpisodeInput(BaseModel):
    season_id: int
    title: str = Field(min_length=1)
    episode_number: int = Field(ge=0)
    duration_seconds: int | None = Field(default=None, ge=1)
    language: str = Field(min_length=2, max_length=16)
    content_group: str = Field(min_length=1)
    status: Literal["draft", "published"] = "draft"


class ArtworkInput(BaseModel):
    show_id: int
    kind: Literal["poster", "banner", "thumbnail"]
    filename: str
    data_base64: str
    episode_id: int | None = None


def role_from_headers(x_peblo_role: str | None, x_peblo_token: str | None) -> str:
    """Server-side authorization; role claims are rejected unless matching configured credentials."""
    admin_token = os.getenv("FASTAPI_ADMIN_TOKEN", "peblo-local-admin")
    editor_token = os.getenv("FASTAPI_EDITOR_TOKEN", "peblo-local-editor")
    if x_peblo_role == "admin" and x_peblo_token == admin_token:
        return "admin"
    if x_peblo_role == "editor" and x_peblo_token in {admin_token, editor_token}:
        return "editor"
    raise HTTPException(401, "A valid server-side CMS credential is required.")


async def require_editor(x_peblo_role: str | None = Header(None), x_peblo_token: str | None = Header(None)) -> str:
    return role_from_headers(x_peblo_role, x_peblo_token)


async def require_admin(x_peblo_role: str | None = Header(None), x_peblo_token: str | None = Header(None)) -> str:
    role = role_from_headers(x_peblo_role, x_peblo_token)
    if role != "admin":
        raise HTTPException(403, "Admin role is required to publish a catalogue.")
    return role


def image_errors(kind: str, data: bytes) -> tuple[int, int, str]:
    if len(data) > 200 * 1024:
        raise HTTPException(422, "Artwork must be 200KB or smaller.")
    try:
        image = Image.open(BytesIO(data))
        width, height = image.size
        mime = Image.MIME.get(image.format, "")
    except Exception as exc:
        raise HTTPException(422, "Artwork must be a readable PNG or JPEG image.") from exc
    expected = {"poster": 2 / 3, "banner": 16 / 9, "thumbnail": 16 / 9}[kind]
    actual = width / height
    if abs(actual - expected) > 0.03:
        raise HTTPException(422, f"{kind.title()} artwork must use a {('2:3' if kind == 'poster' else '16:9')} aspect ratio.")
    if width < 320 or height < 180:
        raise HTTPException(422, "Artwork dimensions are too small; use at least 320px wide.")
    if mime not in {"image/jpeg", "image/png"}:
        raise HTTPException(422, "Artwork must be PNG or JPEG.")
    return width, height, mime


async def build_catalogue(session: AsyncSession, version: str) -> dict:
    rows = (await session.execute(text("""
      SELECT s.id AS show_id, s.title AS show_title, s.slug, s.section, s.categories, s.synopsis,
             se.number AS season_number, e.title AS episode_title, e.episode_number, e.duration_seconds,
             e.language, e.content_group,
             COALESCE((SELECT url FROM artwork a WHERE a.show_id=s.id AND a.kind='poster' LIMIT 1), '') AS poster_url,
             COALESCE((SELECT url FROM artwork a WHERE a.show_id=s.id AND a.kind='banner' LIMIT 1), '') AS banner_url,
             COALESCE((SELECT url FROM artwork a WHERE a.show_id=s.id AND a.kind='thumbnail' LIMIT 1), '') AS thumbnail_url
      FROM shows s JOIN seasons se ON se.show_id=s.id JOIN episodes e ON e.season_id=se.id
      WHERE s.status='published' AND e.status='published'
      ORDER BY s.title, se.number, e.episode_number, e.language
    """))).mappings().all()
    shows: dict[int, dict] = {}
    variants: dict[tuple[int, str], list[dict]] = {}
    for row in rows:
        if not row["section"]:
            continue
        show = shows.setdefault(row["show_id"], {"id": row["show_id"], "title": row["show_title"], "slug": row["slug"], "section": row["section"], "categories": row["categories"], "synopsis": row["synopsis"], "posterUrl": row["poster_url"], "bannerUrl": row["banner_url"], "seasons": [], "trailers": []})
        variants.setdefault((row["show_id"], row["content_group"]), []).append(dict(row))
    for (show_id, _group), group in variants.items():
        representative = sorted(group, key=lambda item: item["language"])[0]
        episode = {"contentGroup": representative["content_group"], "title": representative["episode_title"], "episodeNumber": representative["episode_number"], "durationSeconds": representative["duration_seconds"] or 0, "languages": sorted({item["language"] for item in group}), "thumbnailUrl": representative["thumbnail_url"]}
        show = shows[show_id]
        if representative["season_number"] == 0:
            show["trailers"].append(episode)
        else:
            season = next((value for value in show["seasons"] if value["number"] == representative["season_number"]), None)
            if season is None:
                season = {"number": representative["season_number"], "episodes": []}
                show["seasons"].append(season)
            season["episodes"].append(episode)
    sections: dict[str, list[dict]] = {}
    for show in shows.values():
        show["seasons"].sort(key=lambda season: season["number"])
        sections.setdefault(show["section"], []).append(show)
    return {"version": version, "generatedAt": datetime.now(timezone.utc).isoformat(), "sections": [{"id": key, "shows": sorted(value, key=lambda show: show["title"])} for key, value in sorted(sections.items())]}


def filter_catalogue(catalogue: dict, q: str | None, category: str | None, language: str | None, section: str | None) -> dict:
    query = (q or "").strip().lower()
    sections = []
    for item in catalogue.get("sections", []):
        if section and item["id"] != section:
            continue
        shows = []
        for show in item["shows"]:
            all_episodes = [episode for season in show["seasons"] for episode in season["episodes"]] + show["trailers"]
            haystack = [show["title"], *show["categories"], *(episode["title"] for episode in all_episodes)]
            if query and not any(query in value.lower() for value in haystack):
                continue
            if category and category not in show["categories"]:
                continue
            if language and not any(language in episode["languages"] for episode in all_episodes):
                continue
            shows.append(show)
        if shows:
            sections.append({"id": item["id"], "shows": shows})
    return {**catalogue, "sections": sections}


async def active_catalogue(session: AsyncSession) -> dict:
    row = (await session.execute(text("""
      SELECT cs.payload FROM catalogue_state st JOIN catalogue_snapshots cs ON cs.version=st.active_version WHERE st.singleton=true
    """))).scalar_one_or_none()
    if not row:
        raise HTTPException(503, "The first catalogue has not been published yet.")
    return row


@app.get("/api/health")
async def health(session: AsyncSession = Depends(get_session)):
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "service": "peblo-tv-mini-fastapi", "database": "postgresql"}


@app.get("/catalog")
async def catalogue(session: AsyncSession = Depends(get_session)):
    return await active_catalogue(session)


@app.get("/catalog/search")
async def search_catalogue(q: str | None = None, category: str | None = None, language: str | None = None, section: str | None = None, session: AsyncSession = Depends(get_session)):
    return filter_catalogue(await active_catalogue(session), q, category, language, section)


@app.get("/admin/validation-report")
async def validation_report(_role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    issue_rows = (await session.execute(text("SELECT id, external_id, severity, message, created_at FROM import_issues ORDER BY id"))).mappings().all()
    blocking = (await session.execute(text("""
      SELECT e.id, 'error' AS severity, 'Published episode needs duration and thumbnail artwork.' AS message
      FROM episodes e JOIN seasons se ON se.id=e.season_id
      WHERE e.status='published' AND (e.duration_seconds IS NULL OR NOT EXISTS (SELECT 1 FROM artwork a WHERE a.show_id=se.show_id AND a.kind='thumbnail'))
    """))).mappings().all()
    return {"issues": [dict(row) for row in issue_rows] + [dict(row) for row in blocking], "blockingCount": len(blocking) + sum(row["severity"] == "error" for row in issue_rows)}


@app.get("/admin/shows")
async def list_shows(_role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(text("SELECT id, title, slug, section, categories, synopsis, status FROM shows ORDER BY title"))).mappings().all()
    return {"shows": [dict(row) for row in rows]}


@app.post("/admin/shows", status_code=201)
async def create_show(payload: ShowInput, _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    if payload.status == "published" and not payload.section:
        raise HTTPException(422, "Published shows need a section.")
    try:
        value = (await session.execute(text("""
          INSERT INTO shows (title, slug, section, categories, synopsis, status) VALUES (:title, :slug, :section, CAST(:categories AS jsonb), :synopsis, :status) RETURNING id
        """), {**payload.model_dump(), "categories": json.dumps(payload.categories)})).scalar_one()
        await session.commit()
        return {"id": value}
    except Exception as exc:
        await session.rollback()
        raise HTTPException(422, "Show slug must be unique.") from exc


@app.patch("/admin/shows/{show_id}")
async def update_show(show_id: int, payload: ShowInput, _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    if payload.status == "published" and not payload.section:
        raise HTTPException(422, "Published shows need a section.")
    result = await session.execute(text("""
      UPDATE shows SET title=:title, slug=:slug, section=:section, categories=CAST(:categories AS jsonb), synopsis=:synopsis, status=:status, updated_at=now() WHERE id=:id
    """), {**payload.model_dump(), "id": show_id, "categories": json.dumps(payload.categories)})
    await session.commit()
    if result.rowcount != 1:
        raise HTTPException(404, "Show not found.")
    return {"id": show_id}


@app.post("/admin/seasons", status_code=201)
async def create_season(payload: SeasonInput, _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    try:
        value = (await session.execute(text("INSERT INTO seasons (show_id, number, title) VALUES (:show_id, :number, :title) RETURNING id"), payload.model_dump())).scalar_one()
        await session.commit()
        return {"id": value}
    except Exception as exc:
        await session.rollback()
        raise HTTPException(422, "A show can have each season number only once.") from exc


@app.patch("/admin/seasons/{season_id}")
async def update_season(season_id: int, payload: SeasonInput, _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    result = await session.execute(text("UPDATE seasons SET show_id=:show_id, number=:number, title=:title WHERE id=:id"), {**payload.model_dump(), "id": season_id})
    await session.commit()
    if result.rowcount != 1:
        raise HTTPException(404, "Season not found.")
    return {"id": season_id}


@app.get("/admin/episodes")
async def list_episodes(query: str | None = None, section: str | None = None, language: str | None = None, status: Literal["draft", "published"] | None = None, page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100), _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    filters = ["1=1"]
    params: dict = {"limit": page_size, "offset": (page - 1) * page_size}
    if query:
        filters.append("(lower(e.title) LIKE :query OR lower(s.title) LIKE :query)")
        params["query"] = f"%{query.lower()}%"
    if section:
        filters.append("s.section=:section")
        params["section"] = section
    if language:
        filters.append("e.language=:language")
        params["language"] = language
    if status:
        filters.append("e.status=:status")
        params["status"] = status
    where = " AND ".join(filters)
    rows = (await session.execute(text(f"""
      SELECT e.id, e.title, e.episode_number, e.duration_seconds, e.language, e.content_group, e.status,
             se.id AS season_id, se.number AS season_number, s.id AS show_id, s.title AS show_title, s.section
      FROM episodes e JOIN seasons se ON se.id=e.season_id JOIN shows s ON s.id=se.show_id
      WHERE {where} ORDER BY s.title, se.number, e.episode_number, e.language LIMIT :limit OFFSET :offset
    """), params)).mappings().all()
    total = (await session.execute(text(f"SELECT count(*) FROM episodes e JOIN seasons se ON se.id=e.season_id JOIN shows s ON s.id=se.show_id WHERE {where}"), params)).scalar_one()
    return {"episodes": [dict(row) for row in rows], "page": page, "pageSize": page_size, "total": total}


@app.post("/admin/episodes", status_code=201)
async def create_episode(payload: EpisodeInput, _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    try:
        value = (await session.execute(text("""
          INSERT INTO episodes (season_id, title, episode_number, duration_seconds, language, content_group, status)
          VALUES (:season_id, :title, :episode_number, :duration_seconds, :language, :content_group, :status) RETURNING id
        """), payload.model_dump())).scalar_one()
        await session.commit()
        return {"id": value}
    except Exception as exc:
        await session.rollback()
        raise HTTPException(422, "Episode language must be unique within its content group.") from exc


@app.patch("/admin/episodes/{episode_id}")
async def update_episode(episode_id: int, payload: EpisodeInput, _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    try:
        result = await session.execute(text("""
          UPDATE episodes SET season_id=:season_id, title=:title, episode_number=:episode_number, duration_seconds=:duration_seconds, language=:language, content_group=:content_group, status=:status WHERE id=:id
        """), {**payload.model_dump(), "id": episode_id})
        await session.commit()
        if result.rowcount != 1:
            raise HTTPException(404, "Episode not found.")
        return {"id": episode_id}
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        raise HTTPException(422, "Episode language must be unique within its content group.") from exc


@app.delete("/admin/{kind}/{record_id}")
async def delete_content(kind: Literal["shows", "seasons", "episodes"], record_id: int, _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    table = {"shows": "shows", "seasons": "seasons", "episodes": "episodes"}[kind]
    result = await session.execute(text(f"DELETE FROM {table} WHERE id=:id"), {"id": record_id})
    await session.commit()
    if result.rowcount != 1:
        raise HTTPException(404, f"{kind[:-1].title()} not found.")
    return {"deleted": True, "id": record_id}


@app.post("/admin/artwork/upload", status_code=201)
async def upload_artwork(payload: ArtworkInput, _role: str = Depends(require_editor), session: AsyncSession = Depends(get_session)):
    try:
        data = base64.b64decode(payload.data_base64, validate=True)
    except ValueError as exc:
        raise HTTPException(422, "Artwork data must be valid base64.") from exc
    width, height, mime = image_errors(payload.kind, data)
    extension = "png" if mime == "image/png" else "jpg"
    key = f"artwork/{payload.show_id}/{payload.kind}-{uuid.uuid4().hex}.{extension}"
    get_storage().put_bytes(key, data)
    url = public_asset_url(key)
    await session.execute(text("""
      INSERT INTO artwork (show_id, episode_id, kind, object_key, url, width, height, size_bytes, mime_type)
      VALUES (:show_id, :episode_id, :kind, :key, :url, :width, :height, :size_bytes, :mime)
      ON CONFLICT (show_id, episode_id, kind) DO UPDATE SET object_key=EXCLUDED.object_key, url=EXCLUDED.url, width=EXCLUDED.width, height=EXCLUDED.height, size_bytes=EXCLUDED.size_bytes, mime_type=EXCLUDED.mime_type
    """), {"show_id": payload.show_id, "episode_id": payload.episode_id, "kind": payload.kind, "key": key, "url": url, "width": width, "height": height, "size_bytes": len(data), "mime": mime})
    await session.commit()
    return {"url": url, "width": width, "height": height}


@app.post("/admin/catalog/publish", status_code=201)
async def publish(_role: str = Depends(require_admin), session: AsyncSession = Depends(get_session)):
    report = await validation_report("admin", session)
    if report["blockingCount"]:
        await session.execute(text("INSERT INTO publish_runs (version, actor_role, result, detail) VALUES ('blocked', 'admin', 'blocked', CAST(:detail AS jsonb))"), {"detail": json.dumps(report)})
        await session.commit()
        raise HTTPException(422, {"error": "Publishing is blocked until validation issues are fixed.", "report": report})
    version = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8]
    payload = await build_catalogue(session, version)
    key = get_storage().put_json_atomic(version, payload)
    await session.execute(text("INSERT INTO catalogue_snapshots (version, object_key, payload) VALUES (:version, :key, CAST(:payload AS jsonb))"), {"version": version, "key": key, "payload": json.dumps(payload)})
    await session.execute(text("""
      INSERT INTO catalogue_state (singleton, active_version) VALUES (true, :version)
      ON CONFLICT (singleton) DO UPDATE SET active_version=EXCLUDED.active_version, updated_at=now()
    """), {"version": version})
    await session.execute(text("INSERT INTO publish_runs (version, actor_role, result, detail) VALUES (:version, 'admin', 'published', '{}'::jsonb)"), {"version": version})
    await session.commit()
    return {"version": version, "catalogue": payload}


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
