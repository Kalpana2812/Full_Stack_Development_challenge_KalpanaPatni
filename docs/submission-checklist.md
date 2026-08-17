# Peblo TV Mini Evaluator Submission Checklist

Use this checklist immediately before sharing the Git repository. It distinguishes material that is present in the repository from actions that must occur in the evaluator’s own Docker environment.

| Item | Evidence or action | Status to confirm |
|---|---|---|
| Source repository | Commit all project files except `.env`, dependencies and local volumes | [ ] |
| Local start | Run `docker compose up --build` from the repository root | [ ] |
| Viewer | Open `http://localhost:3000`; inspect hero, rows, detail, season-zero trailers and filters | [ ] |
| CMS | Open `/cms`, sign in locally, inspect validation report, edit a draft and publish as admin | [ ] |
| Node health | Open `http://localhost:3000/api/health` | [ ] |
| FastAPI health | Open `http://localhost:8000/api/health` and confirm `database: postgresql` | [ ] |
| FastAPI catalogue | Open `http://localhost:8000/catalog`; confirm the seeded snapshot returns | [ ] |
| Tests | Run `pnpm check`, `pnpm test`, and `PYTHONPATH=fastapi pytest -q fastapi/tests` | [ ] |
| CI | Confirm `.github/workflows/ci.yml` passes on the final branch | [ ] |
| Image build | Confirm CI builds both `docker/Dockerfile.node` and `fastapi/Dockerfile` | [ ] |
| Secrets | Ensure no actual credentials exist in Git; use `environment.example` only as a template | [ ] |
| Walkthrough | Record the script in `docs/screen-recording-script.md` and attach/share the video URL | [ ] |

> **Evaluator note:** The original interactive surface remains the Node/MySQL application at port 3000. The repository also includes a separately runnable FastAPI/PostgreSQL service at port 8000 to meet the specified backend requirement without destabilising the established viewer/CMS workflow.
