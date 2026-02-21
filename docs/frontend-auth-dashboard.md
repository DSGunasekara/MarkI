# Frontend Auth + Employer Dashboard

## Scope
The frontend now provides a production-style employer workspace with:
- Session-based auth (sign in/up/out)
- Full-width dashboard header and dense layout
- Recent assignments table
- Recent submissions table
- Assignment creation panel with inline validation
- UI styling mapped to theme tokens from `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/index.css` (`app-shell`, `app-panel`, `app-header`, `app-overline`)

## Frontend Files
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/App.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/main.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/lib/api.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/auth/auth-panel.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/employer-dashboard.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/candidate-pending.tsx`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/shared/error-boundary.tsx`

## Backend Files (supporting dashboard UX)
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/routes/dashboard.routes.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/controllers/dashboard.controller.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/dashboard.service.ts`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/packages/db/src/schema.ts`

## Auth Flow
1. App bootstrap calls `GET /api/session/me`.
2. `401` routes to auth panel.
3. Sign up via `POST /api/auth/sign-up/email` (role supported).
4. Sign in via `POST /api/auth/sign-in/email`.
5. Sign out via `POST /api/auth/sign-out`.

All requests include cookies (`credentials: include`).

## Dashboard Flow
1. Employer dashboard loads and requests:
   - `GET /api/dashboard/overview?assignmentsLimit=10&submissionsLimit=12`
2. API returns:
   - Metrics summary
   - Recent assignments with submission counts
   - Recent submissions with status and repository URLs
3. Assignment creation posts to:
   - `POST /api/assignments`
4. On create success, overview is refreshed to keep lists and KPIs current.

## UX Decisions
- Full-width top header for global controls and account identity.
- Compact KPI cards for quick scanning.
- Two-panel core workflow:
  - left: operational visibility (recent assignments)
  - right: primary action (create assignment)
- Dedicated submissions table below for pipeline monitoring.
- Empty states and loading states for all data regions.
- Refresh action to resync without page reload.

## Required Environment Variables
- `VITE_API_BASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
