# Employer Submissions Explorer

## Purpose
Provide an employer-focused page to inspect all submissions grouped by assignment with usable filters and pagination.

## Frontend Route
- `/employer/submissions`
- Supports deep link filter via query:
  - `/employer/submissions?assignmentId=<assignment-id>`

## Backend Endpoint
- `GET /api/dashboard/submissions`

## Supported Filters
- `assignmentId` (optional)
- `status` (optional)
- `search` (optional)
- `sort` (`newest` or `oldest`)
- `limit` and `offset` for paging

## UI Behavior
1. Dashboard links to explorer via “All submissions”.
2. Clicking an assignment row in employer dashboard opens explorer with `assignmentId` query pre-applied.
3. Explorer loads assignment options and filtered submission records from one API call.
4. Results are grouped by assignment cards.
5. Filters can be applied/cleared without leaving the page.
6. Pagination buttons move through filtered results.

## Files
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/employer-submissions-explorer.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/App.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/lib/api.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/routes/dashboard.routes.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/controllers/dashboard.controller.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/dashboard.service.ts`
