# Sidebar Navigation Layout

## Purpose
Unify employer and candidate workspaces around a left-side navigation shell instead of per-page top navigation bars.

## Implementation
A shared shell component now owns workspace layout:
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/shared/workspace-shell.tsx`

The shell provides:
- Left navigation rail with active state
- Workspace title and description area
- Shared user identity + sign out controls
- Reusable content container sizing with optional `maxWidthClassName`

## Routes Using Sidebar
Employer:
- `/employer/dashboard`
- `/employer/assignments/new`
- `/employer/submissions`

Candidate:
- `/candidate/dashboard`
- `/candidate/submissions/new`

## Data/UX Flow
1. Route resolves in `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/App.tsx`.
2. Route component passes nav items and callbacks to `WorkspaceShell`.
3. Shell renders side navigation and page content consistently across views.
4. Sign out action uses the shared auth API and returns user to the unauthenticated view.

## Notes
- Styling uses tokens and utility classes already defined in `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/index.css`.
- Forms remain in dedicated routes to reduce dashboard clutter while keeping quick access via sidebar navigation.
