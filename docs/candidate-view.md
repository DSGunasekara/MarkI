# Candidate View

## Scope
Candidate users can now:
- Join an assignment using a join code.
- Submit or resubmit a public GitHub repository URL.
- View submission metrics and recent submission history.

## API Endpoints

### `POST /api/candidate/submissions`
Creates or updates a candidate submission for a specific assignment join code.

Request body:
- `joinCode` (string, required)
- `repositoryUrl` (string, required, must be a GitHub repo URL)

Rules:
- Auth required.
- Candidate role required.
- If candidate already submitted for that assignment, the submission is updated and status resets to `pending`.

### `GET /api/candidate/overview`
Returns candidate dashboard data.

Query params:
- `submissionsLimit` (optional, integer `1..25`)

Response:
- `metrics`: submission totals grouped by status.
- `recentSubmissions`: assignment title, join code, repository URL, status, timestamps.

## Backend Files
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/routes/candidate.routes.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/controllers/candidate.controller.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/candidate.service.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/app.ts`

## Frontend Files
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/candidate-pending.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/lib/api.ts`

## UX Flow
1. Candidate signs in.
2. Dashboard loads `GET /api/candidate/overview`.
3. Candidate submits join code + repo URL via form.
4. UI shows success/failure feedback.
5. Dashboard refreshes metrics + submission table.
