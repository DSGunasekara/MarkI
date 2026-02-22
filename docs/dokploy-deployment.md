# Dokploy Deployment

## Goal
Deploy the full Hiring Engine stack with Docker Compose on Dokploy:
- PostgreSQL
- Hono API
- Vite/React web frontend (served by Nginx)

## Docker Artifacts
- API image: `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/Dockerfile`
- Web image: `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/Dockerfile`
- Web Nginx config: `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/nginx.conf`
- Compose stack: `/Users/Dilain/.codex/worktrees/5eff/MarkI/docker-compose.yml`
- Docker ignore rules: `/Users/Dilain/.codex/worktrees/5eff/MarkI/.dockerignore`

## Compose Services
### `postgres`
- Postgres 16
- persistent volume: `hiring_engine_postgres_data`
- healthcheck enabled

### `api`
- Builds from `apps/api/Dockerfile`
- Runs DB migrations on startup:
  - `pnpm --filter @hiring-engine/db migrate`
- Starts API via:
  - `pnpm --filter api exec tsx src/index.ts`
- Exposes port `${API_PORT:-3000}`
- Mounts Docker socket to support submission pipeline container builds/deploys:
  - `/var/run/docker.sock:/var/run/docker.sock`

### `web`
- Builds static frontend from `apps/web/Dockerfile`
- Injects `VITE_API_BASE_URL` at build time
- Serves built app with Nginx and SPA fallback
- Exposes port `${WEB_PORT:-4173}`

## Required Environment Variables
Minimum for production:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`

Optional but recommended:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GITHUB_APP_ID`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_PRIVATE_KEY_BASE64` (preferred)
- `GITHUB_APP_PRIVATE_KEY` (fallback; escaped `\n` format only)
- `GITHUB_APP_WEBHOOK_SECRET`
- `GITHUB_WEBHOOK_SECRET`

Pipeline controls:
- `PIPELINE_DEPLOYMENT_MODE`
- `PIPELINE_PREVIEW_BASE_URL`
- `PIPELINE_PREVIEW_PORT_MIN`
- `PIPELINE_PREVIEW_PORT_MAX`
- `PIPELINE_DEPLOYMENT_BASE_URL`
- `PIPELINE_COMMAND_TIMEOUT_MS`

## Dokploy Notes
1. In Dokploy, deploy using the repository `docker-compose.yml`.
2. Configure environment variables in Dokploy UI (do not hardcode secrets in repo).
   - For GitHub App key, use `GITHUB_APP_PRIVATE_KEY_BASE64` to avoid multiline `.env` parsing issues.
   - Do not paste raw multiline PEM directly into `.env`.
3. Ensure Docker socket mounting is enabled for the API service if you want in-platform build/deploy pipeline support.
4. Set public domains so:
   - web domain points to `web` service
   - API domain (or same domain path routing) points to `api` service
5. Update:
   - `VITE_API_BASE_URL` to your API public URL
   - `BETTER_AUTH_URL` to your API public URL
   - `BETTER_AUTH_TRUSTED_ORIGINS` to include your web public URL
6. Convert PEM to single-line base64 before setting `GITHUB_APP_PRIVATE_KEY_BASE64`, for example:
   - `base64 < github-app-private-key.pem | tr -d '\n'`
