# GitHub App Integration

## Purpose
Support repository updates from different GitHub accounts without requiring each candidate to manually create repository webhooks.

## Endpoints
- `GET /api/integrations/github/app`
- `GET /api/candidate/github/repositories?installationId=<id>`
- `POST /api/candidate/submissions`
- `POST /api/webhooks/github`

## Data Flow
1. Candidate opens submit page and fetches app config (`/api/integrations/github/app`).
2. Candidate installs app using returned install URL.
3. Candidate receives `installation_id` after install (via GitHub setup redirect).
4. Candidate submit page fetches repositories from `/api/candidate/github/repositories`.
5. Candidate selects repository and submits.
6. API validates repository + installation and stores `githubInstallationId`.
7. Future submissions can omit installation ID; API reuses the candidate's latest saved installation automatically.
5. Push events from GitHub App webhook hit `/api/webhooks/github`.
6. Pipeline service finds matching submissions and queues rebuild runs.

## Required Environment Variables
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY_BASE64` (preferred for Dokploy/Compose because it is single-line)
- `GITHUB_APP_SLUG`
- `GITHUB_APP_WEBHOOK_SECRET`

Optional fallback:
- `GITHUB_APP_PRIVATE_KEY` (supports `\n` escaped PEM format)
- `GITHUB_WEBHOOK_SECRET`

## GitHub App Settings
- Webhook URL: `https://<api-host>/api/webhooks/github`
- Subscribe to push events
- Setup URL: `https://<web-host>/candidate/submissions/new`
- After install, GitHub redirects with `installation_id`; UI uses it to load repositories.

## Files
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/github-app.service.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/controllers/integration.controller.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/routes/integration.routes.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/controllers/webhook.controller.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/candidate-submit-repository.tsx`
