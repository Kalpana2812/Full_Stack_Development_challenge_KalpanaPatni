# Project TODO

- [x] Review the provided challenge brief, reference rules, seed dataset, and sample artwork assets.
- [x] Model shows, seasons, episodes, artwork, publish runs, and catalogue snapshots in the Drizzle schema.
- [x] Apply a database migration and seed the supplied show dataset, preserving validation issues for the report.
- [x] Implement an interface-driven storage abstraction with the local/S3 adapter and atomic catalogue file replacement.
- [x] Add editor/admin server-side authorization and CMS CRUD procedures with publishing business rules.
- [x] Implement artwork upload validation for file type, size, required dimensions, and aspect ratio with editor-readable errors.
- [x] Implement validation reporting, deterministic catalogue generation, content-group language collapsing, and composable catalogue search.
- [x] Build the internal CMS: content list, filters, pagination, content editor, artwork slots, validation report, publishing workflow, and run history.
- [x] Build the public viewer UI: featured browse, section rows, search and filters, show detail, grouped language options, trailer exclusion, and image loading states.
- [x] Create meaningful Vitest coverage for artwork validation, publish atomicity, grouping, and authorization.
- [x] Add Docker Compose, GitHub Actions CI, environment template, health check documentation, and README design trade-offs.
- [x] Verify type checks, tests, database queries, responsive UI, and make a final checkpoint.
- [x] Fix local Docker startup so the seeded catalogue snapshot is readable without Manus S3 or OAuth dependencies.
- [x] Cache Node dependencies and the pnpm store in Docker Compose so repeat local startup avoids a full reinstall.
- [x] Add a local-only password-based admin login so Docker users can manage shows, episodes, artwork, and catalogue publishing in Studio.
- [x] Deliver a requirement-by-requirement Peblo TV Mini challenge completion report, explicitly labelling complete, partial, and missing items.
- [x] Add complete secret-free environment coverage in `environment.example` and document/implement the CI image-build plus deploy-step requirements; the managed platform blocks direct `.env.example` creation, which is disclosed in the completion report.
- [x] Add a FastAPI service and PostgreSQL-compatible runtime path without breaking the current local viewer/CMS workflow.
- [x] Add PostgreSQL migrations, seed import, core catalogue APIs, artwork validation, publishing, and role checks to the FastAPI backend.
- [x] Add Docker image build verification and a documented deploy-ready CI step.
- [x] Complete README reasoning on search scale, pre-published catalogue trade-offs, secret management, alerting, omissions, and AI usage.
- [x] Create a concise evaluator submission checklist and screen-recording walkthrough script.
- [x] Fix Windows Docker Compose FastAPI build failure caused by absent Alembic migration files in the user's downloaded project copy; the latest full source checkpoint includes the missing migration tree and must replace the incomplete local copy.
- [x] Guide the user through downloading the latest complete source package, replacing the incomplete Windows folder, and verifying FastAPI migration files before Compose rerun.
- [x] Confirm the user has used the Management UI Code download rather than reopening an older local project folder.
- [x] Remove FastAPI Docker startup dependence on Alembic files that are omitted by the source ZIP export, while retaining database schema bootstrap and seed behavior.
- [x] Remove FastAPI Docker startup dependence on Alembic files that are omitted by the source ZIP export, while retaining database schema bootstrap and seed behavior.

## Source-data investigation notes

- [x] Guide the user to move the downloaded project to an ASCII-only Windows path and reset Docker BuildKit before rerunning Compose.
- [x] Guide the user through Docker Hub TLS timeout recovery, then confirm base image pull and Compose startup.
- [x] Resolve the duplicate content-group/language seed constraint by shipping an updated source package, replacing the stale local copy, and rebuilding a clean development database.
- [x] Make FastAPI seed import skip duplicate content-group/language rows, record the issue, and continue startup.
- [x] Make FastAPI seed import skip duplicate content-group/language rows, record the issue, and continue startup.
- [x] Provide the user with an accurate remaining/partial challenge requirement list and step-by-step CMS validation remediation guide.
- [x] Make existing-episode artwork upload target selection explicit in the CMS, so seed validation errors can be fixed without guessing numeric IDs.
- [x] Recompute seed-derived validation report from current CMS records, so fixing artwork or section removes the corresponding publish blocker.
- [x] Add a service-path regression test proving thumbnail upload requires an explicit selected episode, rejects cross-show ownership, and persists the selected episode ID.
- [x] Refactor validation reporting to derive blockers directly from current CMS data, while retaining seed metadata only as supplemental editorial context.
- [x] Add report/publish regression tests proving repaired CMS data clears blockers and newly invalid current records block publication without historical import issues.
- [x] Add an explicit existing-episode edit action so editors can repair source episode IDs, duration, language, and content group from the CMS.
- [x] Replace manual season ID entry with a selected-show season dropdown and document the actual remediation flow in Gujarati.
- [x] Make the FastAPI/PostgreSQL seed importer transaction-safe when duplicate content-group/language rows are supplied, so Docker Compose startup does not exit.
- [x] Add regression coverage and ship a new Windows-downloadable checkpoint for the observed FastAPI duplicate seed startup failure.
- [x] Keep skipped duplicate seed rows visible as non-blocking CMS warnings, because they have no editable CMS episode record.
- [x] Add regression coverage proving a skipped duplicate warning does not block publishing when current CMS records are valid.
- [x] Recover Windows Docker Desktop from the reported read-only filesystem/EIO failure and verify a clean Compose startup.
- [x] Generate validation-compatible poster, banner, and episode thumbnail artwork for ep_0036 and deliver upload instructions.
- [x] Create and deliver a complete Windows-ready Peblo TV Mini source ZIP package.
- [ ] Fix the Docker-local CMS artwork upload flow so it uses a local storage fallback instead of requiring Forge storage configuration.

- The first Drive link contains the challenge brief and the second Drive link is titled `reference.json`; their browser previews did not expose the source content. The supplied attachment establishes the required fields and rules, while the original JSON files remain to be downloaded or reconstructed only from an accessible source.
