import asyncio
import json
import os
from collections import defaultdict
from io import BytesIO
from pathlib import Path

from PIL import Image
from sqlalchemy import text

from app.database import SessionLocal
from app.storage import get_storage, public_asset_url

SEED_PATH = Path(os.getenv("SEED_PATH", "/data/seed_shows.json"))


def duplicate_variant_message(record: dict, original_external_id: str) -> str:
    return (
        "Duplicate seed variant skipped: "
        f"content_group '{record['content_group']}' already has language "
        f"'{record['language']}' (first supplied by {original_external_id})."
    )


async def seed() -> None:
    if not SEED_PATH.exists():
        raise RuntimeError(f"Seed file missing: {SEED_PATH}")
    records = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    async with SessionLocal() as session:
        if (await session.execute(text("SELECT count(*) FROM shows"))).scalar_one() > 0:
            return
        show_ids: dict[str, int] = {}
        season_ids: dict[tuple[str, int], int] = {}
        seen_artwork: set[tuple[int, str]] = set()
        seen_variants: dict[tuple[str, str], str] = {}
        for record in records:
            slug = record["slug"]
            if slug not in show_ids:
                show_ids[slug] = (await session.execute(text("""
                    INSERT INTO shows (title, slug, section, categories, synopsis, status)
                    VALUES (:title, :slug, :section, CAST(:categories AS jsonb), :synopsis, :status)
                    RETURNING id
                """), {"title": record["show_title"], "slug": slug, "section": record.get("section"), "categories": json.dumps(record.get("categories", [])), "synopsis": record.get("synopsis", ""), "status": record.get("status", "draft")})).scalar_one()
            show_id = show_ids[slug]
            season_key = (slug, int(record["season_number"]))
            if season_key not in season_ids:
                season_ids[season_key] = (await session.execute(text("""
                    INSERT INTO seasons (show_id, number) VALUES (:show_id, :number) RETURNING id
                """), {"show_id": show_id, "number": season_key[1]})).scalar_one()
            duration = record.get("duration_seconds")
            if not duration or duration <= 0:
                await session.execute(text("INSERT INTO import_issues (external_id, severity, message) VALUES (:id, 'error', 'Episode is missing a positive duration.')"), {"id": record.get("episode_id")})
            variant_key = (record["content_group"], record["language"])
            original_external_id = seen_variants.get(variant_key)
            if original_external_id:
                await session.execute(
                    text("INSERT INTO import_issues (external_id, severity, message) VALUES (:id, 'error', :message)"),
                    {
                        "id": record.get("episode_id"),
                        "message": duplicate_variant_message(record, original_external_id),
                    },
                )
                continue
            inserted_episode_id = (await session.execute(text("""
                INSERT INTO episodes (external_id, season_id, title, episode_number, duration_seconds, language, content_group, status)
                VALUES (:external_id, :season_id, :title, :episode_number, :duration_seconds, :language, :content_group, :status)
                ON CONFLICT (content_group, language) DO NOTHING
                RETURNING id
            """), {"external_id": record["episode_id"], "season_id": season_ids[season_key], "title": record["episode_title"], "episode_number": record["episode_number"], "duration_seconds": duration, "language": record["language"], "content_group": record["content_group"], "status": record.get("status", "draft")})).scalar_one_or_none()
            if inserted_episode_id is None:
                await session.execute(
                    text("INSERT INTO import_issues (external_id, severity, message) VALUES (:id, 'error', :message)"),
                    {
                        "id": record.get("episode_id"),
                        "message": duplicate_variant_message(record, original_external_id or "an existing database record"),
                    },
                )
                continue
            seen_variants[variant_key] = record["episode_id"]
            for kind in record.get("artwork_available", []):
                artwork_key = (show_id, kind)
                if artwork_key not in seen_artwork:
                    dimensions = {"poster": (1200, 1800), "banner": (1920, 1080), "thumbnail": (1280, 720)}[kind]
                    object_key = f"seed/{slug}/{kind}.jpg"
                    # Self-contained, neutral seeded artwork keeps every returned URL resolvable
                    # without introducing external image dependencies into the take-home exercise.
                    image = Image.new("RGB", dimensions, color=(24, 17, 40))
                    buffer = BytesIO()
                    image.save(buffer, format="JPEG", quality=82, optimize=True)
                    get_storage().put_bytes(object_key, buffer.getvalue())
                    await session.execute(text("""
                        INSERT INTO artwork (show_id, kind, object_key, url, width, height, size_bytes, mime_type)
                        VALUES (:show_id, :kind, :key, :url, :width, :height, 0, 'image/jpeg')
                    """), {"show_id": show_id, "kind": kind, "key": object_key, "url": public_asset_url(object_key), "width": dimensions[0], "height": dimensions[1]})
                    seen_artwork.add(artwork_key)
            if not record.get("artwork_available"):
                await session.execute(text("INSERT INTO import_issues (external_id, severity, message) VALUES (:id, 'warning', 'Seed row does not declare artwork; inherited show artwork is used for browsing.')"), {"id": record.get("episode_id")})
            if record.get("status") == "published" and not record.get("section"):
                await session.execute(text("INSERT INTO import_issues (external_id, severity, message) VALUES (:id, 'error', 'Published show is missing a browse section.')"), {"id": record.get("episode_id")})
        await session.commit()
        # A deterministic seed snapshot makes GET /catalog usable immediately while still
        # allowing the CMS validation report to surface source-data warnings.
        from app.main import build_catalogue
        version = "seed-initial"
        payload = await build_catalogue(session, version)
        key = get_storage().put_json_atomic(version, payload)
        await session.execute(text("INSERT INTO catalogue_snapshots (version, object_key, payload) VALUES (:version, :key, CAST(:payload AS jsonb))"), {"version": version, "key": key, "payload": json.dumps(payload)})
        await session.execute(text("INSERT INTO catalogue_state (singleton, active_version) VALUES (true, :version) ON CONFLICT (singleton) DO UPDATE SET active_version=EXCLUDED.active_version, updated_at=now()"), {"version": version})
        await session.execute(text("INSERT INTO publish_runs (version, actor_role, result, detail) VALUES (:version, 'system', 'seeded', '{}'::jsonb)"), {"version": version})
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
