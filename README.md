# MarkI: Mini Hiring & Code Evaluation Platform

MarkI is a comprehensive hiring and code evaluation platform designed to assess candidate submissions by seamlessly deploying them and evaluating them using advanced AI. 

## 🏗️ System Architecture

The platform is designed as a monolithic repository (monorepo) using a modern TypeScript stack:

- **Frontend (`apps/web`)**: A dynamic Single Page Application (SPA) built with Vite, React, TanStack Router, and TanStack React Query. It heavily utilizes a Vercel/Linear-inspired dark theme for a premium developer-focused UI.
- **Backend (`apps/api`)**: A fast, robust API built with Hono (Node.js/TypeScript). It manages API routes, authentication, deployment pipelines, and AI interactions.
- **Database (`packages/db`)**: Drizzle ORM managing a PostgreSQL database. It stores users (Candidate/Employer), assignments, submissions, build logs, and AI reports.
- **Authentication**: Powered by better-auth, supporting email/password and GitHub OAuth sign-ins.
- **Job Processing**: Handled natively within the Node API process using an internal worker system (or BullMQ) to clone, build, and deploy candidate submissions (Docker).

## 🚀 Build & Deployment Flow

When a candidate connects their GitHub repository and submits an assignment:

1. **Webhook Trigger**: A queue run is triggered by the submission or by subsequent pushes to the GitHub repository.
2. **Pipeline Execution**: The server-side pipeline worker sequentially:
   - Clones the repository.
   - Validates the project (ensuring it's a Next.js or supported app).
   - Installs dependencies using detected package managers (pnpm/npm/yarn).
   - Runs the build command.
   - Deploys the project.
3. **Deployment Modes**:
   - **Docker Mode**: Builds a container for the app, running it securely. Previews are exposed via host ports or subdomains (e.g., Traefik on Dokploy).
   - **Simulated Mode**: Captures build logs without actively firing up a Docker container.
4. **Log Streaming**: The build logs are captured and stored in Postgres. Employers and candidates can view logs through their respective dashboards (presented logically in a premium interface).

## 🧠 How Evaluation Works

Evaluation heavily leverages the built-in AI pipeline:
1. **Context Extraction**: After a successful build (or a failed build after cloning), the pipeline triggers the `analyze` stage.
2. **Intelligent Sampling**: The platform extracts key metadata (`package.json`, top-level structure) and thoroughly samples source files distributed strategically across different top-level directories (e.g., `components`, `app`, `services`). This ensures the LLM receives a representative view of the codebase.
3. **AI Generation**: A structured prompt is sent to the LLM (e.g., Gemini) asking it to evaluate:
   - Overall project overview.
   - Notable changes and structure.
   - Engineering strengths.
   - Risks or concerns.
   - Suggested follow-up interview questions.
4. **Fallbacks**: If AI generation fails, deterministic fallback content is preserved. The employer reviews detailed insights rather than a black-box numeric score.

## 💬 How AI Q&A Works

Employers can interact directly with the repository via the AI Q&A thread in their dashboard using a responsive chat interface:
1. **Context-Aware Chat**: When reviewing an AI report (via a dialog modal on the dashboard), the employer can send free-form follow-up questions.
2. **Grounded Answers**: The API merges the specific repository context, the existing AI report, and the previous Q&A history.
3. **Conversational Insights**: The backend passes this structured history to the LLM to provide precise, code-grounded answers. This creates an insightful, deeply interactive code review session.

## 🛠️ Step-by-step Instructions to Test the Platform

### 1. Requirements
- Node.js (v20+ recommended)
- `pnpm` (Workspace enabled)
- Docker & Docker Compose (for Postgres and pipeline deployment support)

### 2. Environment Setup
Create the required `.env` files from their respective examples:
- Copy `.env.example` in `apps/api/` to `.env` and fill in necessary secrets:
  - `BETTER_AUTH_SECRET`
  - `GEMINI_API_KEY` (For AI Evaluation / Code Analysis)
  - `GITHUB_APP_*` secrets (Required if testing GitHub App integration).
- Copy other `.env.example` files as applicable across packages/web.
- Run `pnpm install` at the root.

### 3. Start Database & Services
Run the local Postgres service:
```bash
docker compose up -d postgres
```
Apply database migrations from the `packages/db` directory:
```bash
pnpm --filter @hiring-engine/db migrate
```

### 4. Run the Platform
Start the API and Web apps in dev mode:
```bash
pnpm dev
```
- **Web Frontend**: `http://localhost:4173` (or port specific to your local setup)
- **API**: `http://localhost:3000`

### 5. Testing the Flow
1. **Employer Registration**: Access the frontend and sign up as an Employer.
2. **Create Assignment**: From the Employer Dashboard, create a new code assignment and note the Join Code.
3. **Candidate Flow**: In an incognito window, sign up as a Candidate. Enter the Join Code.
4. **Submit Code**: Connect a supported framework repository (e.g., Next.js, Node) using your GitHub repository link.
5. **View Pipeline**: The deployment pipeline will start automatically. You can explore the streaming UI logs in real-time. Once the container is successful, the AI Report generation phase triggers.
6. **Chat with AI**: Back on the Employer Dashboard, open the Candidate's submission to read the generated evaluation report. Ask dynamic code-specific questions in the AI Chat tab.
