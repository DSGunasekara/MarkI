# Build + Deploy Pipeline (Mini Vercel/Dockploy)

## Goal
When a candidate submits a GitHub repository:
1. Queue a build run.
2. Clone, validate, install, build, and deploy.
3. Persist run logs and status in PostgreSQL.
4. Re-run the same pipeline for every GitHub `push` event.

Only Next.js repositories are accepted.

## Database Model
### `submissions` (extended)
- `repository_full_name`
- `github_installation_id`
- `repository_default_branch`
- `latest_commit_sha`
- `deployed_url`
- `last_build_at`

### `build_runs`
- `submission_id`
- `trigger` (`submission` | `push`)
- `status` (`queued` | `running` | `deployed` | `failed`)
- `branch`, `commit_sha`
- `deployment_url`
- `started_at`, `finished_at`

### `build_logs`
- `build_run_id`
- `stage` (`system` | `clone` | `validate` | `install` | `build` | `deploy` | `analyze`)
- `level` (`info` | `warn` | `error`)
- `message`
- `created_at`

## Pipeline Service
File:
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/pipeline.service.ts`

Flow:
1. `enqueuePipelineRun` creates a queued `build_runs` record.
2. In-process worker pulls queued runs sequentially.
3. Run stages:
   - clone repo
   - validate Next.js (`next` dependency + build script)
   - install dependencies (pnpm/yarn/npm detection)
   - run build
   - deploy preview
   - generate AI performance report
   - if run fails after clone, attempt AI report generation before final failure status
4. Each stage writes logs to `build_logs`.
5. Submission status updates:
   - `building` during run
   - `deployed` on success
   - `failed` on failure

## Deployment Modes
### `PIPELINE_DEPLOYMENT_MODE=docker` (default)
- Builds a Docker image for the submitted repository.
- Replaces the active container for that submission.
- Preview exposure strategy is controlled by `PIPELINE_PREVIEW_EXPOSURE_MODE`:
  - `port` (local/dev): publishes container port `3000` to an allocated host port in `PIPELINE_PREVIEW_PORT_MIN..PIPELINE_PREVIEW_PORT_MAX`, then generates URL from `PIPELINE_PREVIEW_BASE_URL`.
  - `subdomain` (production): does **not** publish host ports. Container is started with reverse-proxy labels and URL is generated as `https://preview-<submission>.<PIPELINE_PREVIEW_BASE_DOMAIN>`.

### `PIPELINE_DEPLOYMENT_MODE=simulated`
- Keeps compatibility mode where deployment URL is generated without starting a container.
- Useful when Docker is not available.

## Triggers
### Candidate submission trigger
- Endpoint: `POST /api/candidate/submissions`
- After create/update, a `submission` run is queued automatically.
- If GitHub App is configured, repository must have the app installed before submission is accepted.

## GitHub App Integration
- Public config endpoint: `GET /api/integrations/github/app`
- Installation repository listing: `GET /api/candidate/github/repositories?installationId=<id>`
- Candidate UI exposes install URL for the app.
- Candidate selects repository from installation repositories before submit.
- Server validates repo installation via GitHub App API.
- This supports repositories across different GitHub accounts without per-repo manual webhooks.

### GitHub push trigger
- Endpoint: `POST /api/webhooks/github`
- Expected event header: `x-github-event: push`
- Signature verification via `x-hub-signature-256` using:
  - `GITHUB_APP_WEBHOOK_SECRET` (preferred), fallback `GITHUB_WEBHOOK_SECRET`
- Matches submissions by normalized `repository_full_name`
- Queues one `push` run per matched submission

## Log Retrieval Endpoints
### Candidate logs
- `GET /api/candidate/submissions/:submissionId/logs`
- Optional query: `runId`

### Employer logs
- `GET /api/dashboard/submissions/:submissionId/logs`
- Optional query: `runId`

Both return:
- submission metadata
- selected run
- recent run list
- stage logs

## Frontend UX
Candidate dashboard and employer submissions explorer now include:
- deployment URL visibility
- latest commit SHA
- `View logs` action
- run selector and log console view

Files:
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/candidate-pending.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/employer-submissions-explorer.tsx`

## Environment Variables
Add to API environment:
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY_BASE64` (preferred single-line value for container env files)
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_WEBHOOK_SECRET`
- `GITHUB_WEBHOOK_SECRET` (legacy fallback)
- `PIPELINE_DEPLOYMENT_MODE` (`docker` or `simulated`)
- `PIPELINE_PREVIEW_EXPOSURE_MODE` (`port` or `subdomain`)
- `PIPELINE_PREVIEW_BASE_URL` (base URL for Docker preview links)
- `PIPELINE_PREVIEW_BASE_DOMAIN` (wildcard domain suffix for subdomain exposure mode)
- `PIPELINE_PREVIEW_DOCKER_NETWORK` (Docker network used by preview containers in subdomain mode)
- `PIPELINE_PREVIEW_TRAEFIK_ENTRYPOINTS` (proxy entrypoints used for subdomain routers; defaults to `web`)
- `PIPELINE_PREVIEW_TRAEFIK_TLS` (whether Traefik router requires TLS in subdomain mode)
- `PIPELINE_PREVIEW_PORT_MIN` (minimum host preview port)
- `PIPELINE_PREVIEW_PORT_MAX` (maximum host preview port)
- `PIPELINE_DEPLOYMENT_BASE_URL` (simulated mode URL base)
- `PIPELINE_COMMAND_TIMEOUT_MS` (per command timeout)
- `GEMINI_API_KEY` (required for LLM report generation)
- `GEMINI_MODEL` (optional; defaults to `gemini-3-flash-preview`)

## Notes
- Docker deployment requires Docker daemon access from the API process.
- Worker is in-process and non-distributed; restarting the API process clears in-memory queue state.
- This architecture is a functional mini-hosting pipeline foundation and can later move to dedicated build workers.
