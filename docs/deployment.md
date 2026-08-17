# CI Image Build and Deployment Contract

The continuous-integration workflow runs static TypeScript checks, the existing Vitest suite, the FastAPI contract test, the production Node build, and Docker builds of both service images. The image builds have no production side effect; they catch dependency and Dockerfile failures before a reviewer sees a submission.

The copyable variable template is committed as [`environment.example`](../environment.example). In a normal Git checkout, copy it to `.env` before replacing `CHANGE_ME` entries. The managed project environment deliberately blocks creation of dot-prefixed environment files, which prevents accidental secret commits; the template is therefore kept under a safe, reviewable filename.

Deployment is intentionally **opt-in**. To activate the guarded `deploy` job, a repository administrator must set the GitHub Actions repository variable `ENABLE_DEPLOY` to `true` and add the protected `DEPLOY_COMMAND` secret. The command should deploy immutable image digests, not mutable tags, and must live only in the secret store. GitHub environments can additionally require a reviewer before the production job runs.[1]

For example, a managed container deployment command can pull the image produced by a registry-publish step, apply its required environment variables from the destination platform's secret manager, and run database migrations as a release task before changing traffic. This repository leaves the provider-specific command absent because no cloud account, registry, or deploy target was supplied with the challenge.

The local evaluator path does not use this guarded job. It remains `docker compose up --build`, which starts the legacy Node/MySQL product and the FastAPI/PostgreSQL reference service side by side.

## Reference

[1]: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments "Managing environments for deployment"
