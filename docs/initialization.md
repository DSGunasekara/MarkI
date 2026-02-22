# Initialization: Workspace, Database Schema, and Auth Middleware

## Scope Completed
This initialization pass sets up the foundational backend architecture for the Hiring Engine:

- Workspace expanded to support shared packages.
- New `@hiring-engine/db` package created with Drizzle ORM + `drizzle-zod`.
- Initial PostgreSQL schema added for Better-Auth users and platform assignments.
- Hono API refactored into a controller/service route structure.
- Better-Auth integrated with a reusable Hono auth/session middleware.
- Employer-only assignment creation endpoint added with Zod request validation.

## 1) Workspace Initialization

### Changes
- Updated `pnpm-workspace.yaml`:
  - Added `packages/*` so shared packages are first-class workspace members.
- Added folder layout:
  - `packages/db`
  - `apps/api/src/{controllers,lib,middleware,routes,services,types}`
  - `docs`

### Why
The platform requires a shared DB contract consumed by multiple apps (`api`, future workers, and potentially web tooling). The workspace package keeps schema, inferred types, and validators centralized.

## 2) Drizzle Schema Initialization (`@hiring-engine/db`)

### Package
Path: `packages/db`

Key files:
- `packages/db/src/schema.ts`
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `packages/db/drizzle.config.ts`

### Tables Added

#### Better-Auth Core Tables
- `users`
  - Includes role enum (`employer` | `candidate`) for RBAC.
- `sessions`
- `accounts`
- `verifications`

These are mapped directly into Better-Auth's Drizzle adapter.

#### Platform Table
- `assignments`
  - `id`, `title`, `instructions`, `join_code`, `employer_id`, timestamps.
  - `employer_id` references `users.id`.

### Type Safety (`drizzle-zod`)
Generated schemas and inferred types:
- `userSelectSchema`
- `assignmentSelectSchema`
- `createAssignmentSchema`
- Types: `User`, `UserRole`, `Assignment`, `NewAssignment`

This allows API validation + DB types to stay synchronized.

## 3) Better-Auth + Hono Middleware Setup

### Better-Auth Initialization
File: `apps/api/src/lib/auth.ts`

Configured:
- Drizzle adapter with PostgreSQL provider.
- Schema mapping (`user`, `session`, `account`, `verification`).
- Email/password auth enabled.
- Additional user field: `role` (default: `candidate`).

### Auth Middleware
File: `apps/api/src/middleware/auth.middleware.ts`

Implemented:
- `authSessionMiddleware`
  - Runs once per request.
  - Reads session via Better-Auth API.
  - Stores `session` and `user` on Hono context.
- `requireAuth`
  - 401 if no authenticated user.
- `requireRole(roles)`
  - 403 when role is missing/invalid/not allowed.

The middleware includes JSDoc describing session hydration behavior and rationale.

## 4) API Structure (Controller/Service Pattern)

### Files
- `apps/api/src/app.ts`
- `apps/api/src/controllers/*.ts`
- `apps/api/src/services/*.ts`
- `apps/api/src/routes/*.ts`

### Route Registration
- Better-Auth handler mounted at:
  - `GET|POST /api/auth/*`
- API CORS configured for trusted frontend origins with credentials enabled.
- Health route:
  - `GET /api/health/`
- Session route:
  - `GET /api/session/me`
- Assignment route:
  - `POST /api/assignments/`

### Validation Standard
`@hono/zod-validator` is used for request body validation on assignment creation:
- `zValidator('json', createAssignmentSchema)`

## 5) Data Flow

### A) Session Resolution (every API request)
1. Incoming request enters Hono.
2. `authSessionMiddleware` calls Better-Auth `getSession` with request headers.
3. Context variables are set:
   - `session: Session | null`
   - `user: User | null`
4. Downstream controllers use context rather than repeating auth calls.

### B) Create Assignment (Employer)
1. `POST /api/assignments/` request arrives.
2. Middleware chain:
   - `requireAuth`
   - `requireRole(['employer'])`
   - `zValidator('json', createAssignmentSchema)`
3. Controller delegates to `assignmentService`.
4. Service generates a unique join code and inserts DB record.
5. API returns `201` with assignment payload.

## 6) Environment Variables
Required for runtime:
- `DATABASE_URL`
- `BETTER_AUTH_URL` (optional fallback exists)
- `BETTER_AUTH_TRUSTED_ORIGINS` (optional fallback exists)
- `BETTER_AUTH_SECRET` (recommended for stable auth signing)

Required for Drizzle CLI commands:
- `DATABASE_URL`

Example templates created:
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/.env.example`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/.env.example`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/packages/db/.env.example`
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/.env.example`

## 7) Local Postgres via Docker Compose
Compose file:
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/docker-compose.yml`

Quick start:
1. `docker compose up -d postgres`
2. `docker compose ps`
3. `docker compose logs -f postgres`

Defaults are wired for local development:
- user: `postgres`
- password: `postgres`
- db: `hiring_engine`
- port: `5432`

The default `DATABASE_URL` in `.env.example` already matches this container:
- `postgresql://postgres:postgres@localhost:5432/hiring_engine`

## 8) Next Logical Steps
- Add migrations (`drizzle-kit generate` + apply).
- Introduce submission/build-log/report tables in `@hiring-engine/db`.
- Add candidate onboarding APIs (join via code + GitHub URL).
- Add stubbed Runner service and submission status transitions.
