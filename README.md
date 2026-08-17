# Peblo TV Mini

Peblo TV Mini is a full-stack streaming-catalogue take-home project. It combines a public, Netflix-inspired viewer with a server-enforced editorial CMS, validated artwork workflow, audit-visible seed issues, and atomic catalogue publishing.

| Surface | Purpose | Key behavior |
|---|---|---|
| Viewer browse | Discover approved content | Hero, browse rows, detail pages, filters and search |
| Show detail | Explain programme structure clearly | Language variants collapse together; season-zero content is shown as trailers, not a season |
| Editorial Studio | Manage catalogue data safely | CRUD, validation report, publish history and role-sensitive actions |
| Node API | Serves the existing React product | tRPC plus REST health, catalogue, search, CMS and publish routes |
| FastAPI API | Prescribed FastAPI/PostgreSQL implementation | Independently seeded REST service on port `8000`, with Alembic schema, storage adapters and identical public catalogue routes |

## Run locally

On Windows 10 with Docker Desktop running, open PowerShell in the extracted project folder and run:

```powershell
docker compose up --build
```

Open the viewer at `http://localhost:3000`, the CMS at `http://localhost:3000/cms`, and the FastAPI health check at `http://localhost:8000/api/health`. The local CMS password is `peblo-local-admin`; it is a Docker-only convenience and must be changed before any shared use. The FastAPI development credentials are passed in headers, for example `X-Peblo-Role: admin` plus `X-Peblo-Token: peblo-local-admin`.

The first build downloads images and dependencies. Later starts normally need only `docker compose up`. Use `docker compose down` to stop; use `docker compose down -v` only for a deliberate full reset because it deletes both database volumes and cached dependencies. The compose stack includes the original Node/MySQL application and the FastAPI/PostgreSQL service. This keeps the established interactive viewer and CMS working while making the brief’s specified backend available for direct evaluation.

| Command | Purpose |
|---|---|
| `pnpm check` | Strict TypeScript check |
| `pnpm test` | Existing Vitest suite |
| `pnpm build` | Production React and Node build |
| `PYTHONPATH=fastapi pytest -q fastapi/tests` | FastAPI contract test |
| `docker compose up --build` | Start all seeded local services |

The copyable variable reference is [`environment.example`](environment.example). Copy it to `.env` in a normal local checkout, replace all `CHANGE_ME` values, and do not commit the result. The managed workspace intentionally prevents writing `.env.example`; `environment.example` is the reviewable equivalent with no real secret values.

## Core data and editorial rules

The catalogue schema represents shows, seasons, language-variant episodes, artwork, immutable snapshots, a single active snapshot pointer, publish runs, and seed-import issues. The FastAPI service uses PostgreSQL and Alembic; the original product surface remains Node/Express/tRPC plus MySQL. Both use the supplied 95-row seed source. The FastAPI import is idempotent and creates a usable `seed-initial` snapshot while retaining source-artwork anomalies as CMS-visible warnings.

| Rule | Server-side enforcement |
|---|---|
| Editors can create, edit and delete catalogue records | Credential/role dependency on each CMS endpoint |
| Only admins can publish | `POST /admin/catalog/publish` admin dependency |
| Published shows require a browse section | Show validation before write |
| Published episodes require duration and thumbnail artwork | Publish validation blocks promotion |
| `(content_group, language)` is unique | Database constraint and write validation |
| Artwork is at most 200 KB and valid PNG/JPEG | Byte size and image decoder validation |
| Poster is 2:3; banner/thumbnail are 16:9 | Aspect-ratio and minimum-dimension validation |

## API reference

The Node service exposes the original routes on port `3000`. The FastAPI service exposes the matching public endpoints at port `8000`; CMS requests must supply its local development headers. `GET /catalog`, `GET /catalog/search?q=&category=&language=&section=`, `GET /api/health`, `GET /admin/validation-report`, show/season/episode CRUD, artwork upload, and `POST /admin/catalog/publish` are present in the FastAPI service.

## Required challenge reasoning (one-page summary)

**Atomicity.** A publish builds a whole versioned JSON document first, writes it under a new immutable snapshot key, and only then changes the small active-version pointer in PostgreSQL. The local-file adapter uses a temporary file followed by `os.replace`; the production R2 adapter writes a complete versioned object before the database pointer changes. If the process dies before the database transaction commits, the prior pointer remains readable and any orphaned version is harmless. Public reads never assemble partially published rows.

**Storage abstraction.** Application code depends on `CatalogueStorage`, not filesystem or provider calls. Docker selects `LocalFileStorage`; production selects `R2Storage` with an S3-compatible endpoint. Moving to Cloudflare R2 therefore changes only runtime variables—bucket, endpoint and credentials—and the adapter selection, not the validation, seed, search, or publish logic.

**Search and scale.** The published JSON snapshot is filtered in-process for this exercise. It is simple, deterministic, fast for the provided seed, and avoids exposing drafts. Its limit is linear scans and full-document reads: it will not suit a large catalogue, typo tolerance, ranking, or analytics. The next step is a PostgreSQL full-text/trigram index for modest scale, then a dedicated search index when relevance and faceting become requirements.

**Why pre-publish.** Serving a pre-published immutable catalogue removes expensive joins from hot viewer requests and makes a viewer release easy to cache or roll back. The cost is controlled staleness: a CMS edit is invisible until publishing, and snapshot size grows with the catalogue. This is suitable for editorial release control but not for real-time entitlement or availability decisions.

**Operations, omissions and AI use.** The health endpoint checks database reachability. Alert if `/api/health` fails three probes in five minutes, or if 5xx/error rate rises above the service baseline, because a catalogue service can otherwise look live while its datastore is unreachable. Production secrets belong in the deployment platform’s secret manager, injected at runtime and rotated; no secrets belong in Git, the environment template, browser bundles, or image layers. Omitted by design are media transcoding/playback, CDN signed URLs, real organisation SSO, rate limiting, observability backends, and a provider-specific deploy command—none had credentials or a media source in the brief. AI assistance was used to accelerate scaffolding, documentation and test drafting; generated changes were reviewed against the brief, manually structured around the existing codebase, and verified by compilation/tests rather than accepted solely on generated output.

## CI and deploy handoff

The GitHub Actions workflow runs type checks, Vitest, FastAPI contract tests, production build, and Docker builds for both service images. The deployment job is guarded by the `ENABLE_DEPLOY=true` repository variable and accepts only a protected `DEPLOY_COMMAND` secret. It is deliberately inactive until a reviewer supplies a real registry/provider target. See [deployment guidance](docs/deployment.md).

## Submission materials

Use the [evaluator checklist](docs/submission-checklist.md) before sending the repository. The [screen-recording script](docs/screen-recording-script.md) provides a concise 5–7 minute walkthrough; it is written for the reviewer to record locally after starting Docker Compose.

## References

[1] [FastAPI documentation](https://fastapi.tiangolo.com/)

[2] [Alembic documentation](https://alembic.sqlalchemy.org/en/latest/)

[3] [Cloudflare R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)

[4] [GitHub Actions deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
