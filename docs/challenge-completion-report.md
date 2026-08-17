# Peblo TV Mini Challenge Completion Report

This report maps the requested challenge outcomes to the submitted repository. It is intentionally explicit about the one platform-constrained naming deviation and the dual-backend transition state.

| Challenge requirement | Status | Evidence |
|---|---|---|
| Public Netflix-style viewer, browse/search/detail | Complete | React viewer at port `3000`; hero, rows, filters, language grouping and trailer treatment are implemented. |
| CMS with editorial CRUD and server-side roles | Complete | Node CMS and FastAPI protected CRUD routes; editor/admin enforcement is server-side. |
| Seed import and visible seed issues | Complete | Original importer and FastAPI idempotent seed importer; validation report retains warnings and blocks invalid published shows with no section. |
| Artwork size/type/ratio validation | Complete | Node tests and FastAPI Pillow validation enforce JPEG/PNG, 200 KB, dimensions and ratios. |
| Atomic catalogue publishing | Complete | Versioned object is written first; only then does the active database pointer change. |
| Swappable storage | Complete | Local file plus Cloudflare R2/S3-compatible adapter behind `CatalogueStorage`. |
| FastAPI and PostgreSQL | Complete for the independently runnable API | `fastapi/`, Alembic, PostgreSQL Compose service and port-8000 API are included. The pre-existing interactive UI remains attached to Node/MySQL at port 3000 to avoid a destabilising UI client cutover. |
| Docker Compose seeded startup | Complete | `compose.yaml` starts Node/MySQL plus FastAPI/PostgreSQL and persists working volumes. |
| CI lint/tests/build images/deploy handoff | Complete | CI runs TypeScript/Vitest/FastAPI tests and builds both images. Deployment is guarded until a real provider command is supplied. |
| `.env.example` | Partial, platform-constrained | The platform blocks direct creation of dot-prefixed environment files. `environment.example` is the complete, secret-free copyable equivalent and is documented in the README. |
| Health and alerting recommendation | Complete | Health endpoints and concrete failure/error-rate alert policy are documented. |
| Written reasoning and AI disclosure | Complete | README “Required challenge reasoning” covers atomicity, storage, search scale, snapshot trade-off, omissions, secrets, alerting and AI use. |
| Submission checklist and screen-recording guide | Complete | `docs/submission-checklist.md` and `docs/screen-recording-script.md`. |

> **Reviewer guidance:** Run the local stack, then evaluate the existing full viewer/CMS at `localhost:3000` and the FastAPI/PostgreSQL REST implementation at `localhost:8000`. This parallel approach preserves a proven product path while also providing the backend architecture named in the brief.
