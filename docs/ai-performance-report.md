# AI Performance Report + Follow-Up Q&A

## Goal
After a candidate submission runs through the pipeline, generate an employer-facing AI report that is:
- human-readable
- grounded in repository code context
- explainable (no unexplained numeric score)

Employers can then ask free-form follow-up questions and get grounded AI responses based on:
- repository context
- generated report content
- prior Q&A history

## Data Model
### `ai_reports`
- `submission_id`
- `build_run_id`
- `status` (`pending` | `completed` | `failed`)
- `model`
- `project_overview`
- `notable_structure`
- `engineering_strengths` (`text[]`)
- `risks_or_concerns` (`text[]`)
- `suggested_questions` (`text[]`)
- `analysis_context` (serialized repository context JSON)
- `raw_response`
- `failure_reason`

### `ai_report_messages`
- `ai_report_id`
- `role` (`employer` | `assistant`)
- `message`
- `created_at`

## Pipeline Integration
File:
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/pipeline.service.ts`

Flow:
1. Candidate submission queues a build run.
2. Pipeline clones, validates, installs, builds, and deploys.
3. Pipeline logs stage `analyze` and calls AI report generation:
   - `aiReportService.generateReportForSubmission(...)`
4. If pipeline fails after repository clone, an additional `analyze` attempt still runs so employers can review code even when deployment fails.
5. On AI failure, pipeline/deployment status is preserved and an `analyze` warning log is persisted.

## AI Service
File:
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/api/src/services/ai-report.service.ts`

Responsibilities:
1. Build repository context from:
   - assignment + submission metadata
   - `package.json`
   - top-level entries
   - sampled source files (distributed intelligently across different top-level directories for a representative view)
2. Generate structured report via LLM (e.g. Gemini) context evaluation (`json_schema` response format).
3. Fallback to deterministic report content if LLM call fails.
4. Persist report status/content in `ai_reports`.
5. Answer employer follow-up questions and persist messages in `ai_report_messages`.

## Employer API Endpoints
### Get report + thread
- `GET /api/dashboard/submissions/:submissionId/ai-report`
- auth: employer only
- returns:
  - submission metadata
  - latest AI report (or `null`)
  - message thread

### Ask follow-up question
- `POST /api/dashboard/submissions/:submissionId/ai-report/questions`
- auth: employer only
- body:
  - `question: string` (3..2000 chars)
- returns:
  - `answer: string`

## Frontend UX
File:
- `/Users/Dilain/.codex/worktrees/5eff/MarkI/apps/web/src/components/dashboard/employer-submissions-explorer.tsx`

Behavior:
1. Each submission row provides `View report`.
2. AI report panel renders:
   - project overview
   - notable structure or changes
   - engineering strengths
   - risks or concerns
   - suggested interview follow-up questions
3. Employer can ask free-form follow-up questions.
4. Q&A thread is shown with role + timestamp and refreshable report state.

## Environment Variables
Required in API runtime:
- `GEMINI_API_KEY` (or fallback `OPENAI_API_KEY`)

Optional:
- `GEMINI_MODEL` (default: `gemini-3-flash-preview`)

## Notes
- AI output assists employer evaluation; it does not replace evaluation logic.
- If report generation fails, fallback content or explicit failure reasons are stored for transparency.
