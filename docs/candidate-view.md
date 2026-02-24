# Candidate View

## Scope
Candidate users can now:
- Join an assignment using a join code.
- Select a repository from GitHub App installation and submit/resubmit.
- View submission metrics and recent submission history.
- Navigate between candidate routes from a shared sidebar workspace shell.
- Inspect build/deploy logs for each submission run.
- Install and use the Codr AI GitHub App for cross-account push rebuild automation.
- Use separate routes:
  - dashboard: `/candidate/dashboard`
  - submit form: `/candidate/submissions/new`

## API Endpoints

### `POST /api/candidate/submissions`
Creates or updates a candidate submission for a specific assignment join code.

Request body:
- `joinCode` (string, required)
- Either:
  - `repositoryUrl` (string, optional fallback)
  - or `repositoryFullName` + `githubInstallationId` (recommended app flow)

Rules:
- Auth required.
- Candidate role required.
- If candidate already submitted for that assignment, the submission is updated and status resets to `pending`.
- A build run is queued immediately after submission creation/update.
- If GitHub App is configured on server, repository must have app installation.

### `GET /api/candidate/github/repositories?installationId=<id>`
Returns repositories visible to the provided GitHub App installation.

If `installationId` is omitted, API reuses the candidate's latest saved installation ID from previous submissions.

### `GET /api/integrations/github/app`
Returns GitHub App public integration config used by the candidate submission page.

### `GET /api/candidate/overview`
Returns candidate dashboard data.

Query params:
- `submissionsLimit` (optional, integer `1..25`)

Response:
- `metrics`: submission totals grouped by status.
- `recentSubmissions`: assignment title, join code, repository URL, status, timestamps.

### `GET /api/candidate/submissions/:submissionId/logs`
Returns pipeline runs and stage logs for a candidate-owned submission.

Query params:
- `runId` (optional, UUID) to inspect a specific run.

## Backend Files
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/routes/candidate.routes.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/controllers/candidate.controller.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/candidate.service.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/app.ts`

## Frontend Files
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/candidate-pending.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/candidate-submit-repository.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/shared/workspace-shell.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/lib/api.ts`

## UX Flow
1. Candidate signs in.
2. Dashboard route (`/candidate/dashboard`) loads `GET /api/candidate/overview`.
3. Candidate opens submit route (`/candidate/submissions/new`) and submits join code + repo URL.
4. UI shows success/failure feedback.
5. Candidate returns to dashboard to review updated statuses.
