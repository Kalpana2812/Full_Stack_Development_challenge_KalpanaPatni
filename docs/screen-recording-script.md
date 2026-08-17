# Peblo TV Mini Screen-Recording Walkthrough

Target duration: **5–7 minutes**. Start the stack with `docker compose up --build` before recording. Use a fresh browser window and keep the terminal visible for the opening and closing checks.

| Time | Screen action | Narration cue |
|---|---|---|
| 0:00–0:30 | Show repository root, `compose.yaml`, then the successful service logs. | “This project starts the viewer/CMS product and an independently seeded FastAPI/PostgreSQL implementation with one Compose command.” |
| 0:30–1:30 | Open the viewer at port 3000. Scroll hero and horizontal sections. | “The viewer uses a published catalogue snapshot, with sectioned rows and poster/banner artwork slots.” |
| 1:30–2:15 | Open a show detail page with season-zero material. | “Language variants collapse into one episode, while season-zero records are explicitly separated as trailers rather than appearing in the normal season selector.” |
| 2:15–2:45 | Open search; search a title and apply category/language filters. | “Search reads the active immutable catalogue only, so drafts cannot leak into public browse.” |
| 2:45–4:15 | Go to `/cms`, sign in with the local password, show validation report and episode list. Make a safe draft edit or create a draft record. | “The interface helps the editor, but permissions are enforced by server endpoints. Seed anomalies are visible in the validation report.” |
| 4:15–4:50 | Show that an editor cannot publish, then publish as local admin if the report allows it. | “Publishing validates first, writes a versioned object, then swaps the active reader pointer. An interrupted publish leaves the old version active.” |
| 4:50–5:35 | Open `http://localhost:8000/api/health`, then `/catalog`. | “This is the FastAPI/PostgreSQL service. It has Alembic migration, idempotent seed import, role-protected REST routes, its own atomic catalogue snapshot and storage adapter.” |
| 5:35–6:15 | Return to terminal and run `pnpm test` and `PYTHONPATH=fastapi pytest -q fastapi/tests`, or show completed output. | “The Node unit suite covers artwork, language grouping, publishing and roles; the FastAPI contract test covers public search behavior.” |
| 6:15–6:45 | Show `README.md`, `environment.example`, CI workflow and `docs/deployment.md`. | “The repository includes operating instructions, production secret guidance, image-build CI and a protected deploy handoff rather than an invented cloud target.” |

End with the evaluator checklist. Do not display real API keys, cloud credentials, local `.env` files, database dumps, or browser cookies during recording.
