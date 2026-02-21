# Employer Dashboard Overview API

## Purpose
Provide a single endpoint for employer dashboard data so the UI can render metrics and recent activity with one request.

## Endpoint
- `GET /api/dashboard/overview`
- `GET /api/dashboard/submissions`
- `GET /api/dashboard/submissions/:submissionId/logs`

### Query Params
- `assignmentsLimit` (optional, integer, `1..25`)
- `submissionsLimit` (optional, integer, `1..25`)

`/submissions` query params:
- `assignmentId` (optional, UUID)
- `status` (optional: `pending|building|deployed|failed`)
- `search` (optional text search over assignment, join code, candidate, repository)
- `sort` (optional: `newest|oldest`, default `newest`)
- `limit` (optional, integer `1..100`, default `25`)
- `offset` (optional, integer `>= 0`, default `0`)

### Auth
- Requires authenticated session.
- Requires `employer` role.

## Response Shape
- `metrics`
  - `assignmentCount`
  - `submissionCount`
  - `pendingCount`
  - `buildingCount`
  - `deployedCount`
  - `failedCount`
- `recentAssignments[]`
  - assignment identity, join code, submission count, latest submission timestamp
- `recentSubmissions[]`
  - submission identity, assignment title, candidate id, repository URL, status, timestamps

`/submissions` response:
- `filters`
- `assignmentOptions[]`
- `totalSubmissions`
- `submissions[]`
  - includes assignment title/join code + candidate name/email + status/timestamps + deployment metadata

`/submissions/:submissionId/logs` response:
- `submission`
- `selectedRun`
- `runs[]`
- `logs[]`

## Data Flow
1. Route validates query params with `@hono/zod-validator`.
2. Controller verifies authenticated employer from middleware context.
3. Service executes aggregated SQL via Drizzle:
   - metrics query
   - recent assignments query (with submission counts)
   - recent submissions query
4. Controller returns normalized JSON under `data`.

## Related Files
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/routes/dashboard.routes.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/controllers/dashboard.controller.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/dashboard.service.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/packages/db/src/schema.ts`
