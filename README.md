# MarkI: Mini Hiring & Code Evaluation Platform

MarkI is a comprehensive hiring and code evaluation platform designed to assess candidate submissions by seamlessly deploying them and evaluating them using advanced AI. 

## 📐 Design Approach & Technical Decisions

The platform was built with a strong focus on developer experience (DX), performance, and a premium user interface. Here is a breakdown of the core technical decisions and why they were chosen:

- **Monorepo Architecture**: We chose a monorepo approach to seamlessly share TypeScript types, configurations (like ESLint and Prettier), and utilities across the frontend (`apps/web`), backend (`apps/api`), and database packages (`packages/db`). This ensures end-to-end type safety and reduces context switching.
- **Vite + React + TanStack Ecosystem (Frontend)**: 
  - **Vite** provides lightning-fast HMR and optimized builds. 
  - **TanStack Router** was chosen for type-safe routing, ensuring that navigation and URL parameters are strictly typed.
  - **TanStack React Query** handles complex asynchronous data fetching, caching, and state management cleanly, replacing manual `useEffect` implementations for a more robust data layer.
- **Premium UI/UX**: The interface takes direct inspiration from Vercel and Linear, utilizing a cohesive dark theme. We prioritized a sleek, developer-focused aesthetic using global CSS variables for themes, refined components, loading skeletons for perceived performance, and intuitive dialogs (modals) for logs and AI reports.
- **Hono (Backend)**: Hono was selected as the web framework for its extreme lightweight nature, incredible performance, and excellent TypeScript support. It provides a clean syntax for defining API routes while maintaining a small footprint.
- **Drizzle ORM & PostgreSQL**: Drizzle ORM offers a type-safe, SQL-like querying experience without the heavy abstraction and bloat of traditional ORMs. Paired with PostgreSQL, it ensures robust, relational data integrity for users, assignments, and complex evaluation logs.
- **Better Auth**: Chosen for its straightforward, modular approach to authentication, easily scaling to support both email/password and GitHub OAuth strategies without heavy vendor lock-in or complex setups.
- **Native Node.js Pipeline, Docker & Traefik**: Instead of relying on external message queues (like BullMQ or Redis), the core code evaluation engine was built natively. It uses an in-memory queue and Node's `child_process` to handle resource-intensive tasks like cloning repositories, installing dependencies, and building projects. It interacts directly with the Docker CLI to spin up containers, dynamically injecting Traefik labels to securely expose candidate previews under subdomains without complex orchestration.

## 🏗️ System Architecture

- **Frontend (`apps/web`)**: A dynamic Single Page Application (SPA).
- **Backend (`apps/api`)**: A fast, robust API managing authentication, deployment pipelines, and AI interactions.
- **Database (`packages/db`)**: Manages the PostgreSQL database, storing users (Candidate/Employer), assignments, submissions, build logs, and AI reports.
- **Job Processing**: Handled natively within the Node API process using an internal worker system to safely clone, build, and deploy candidate submissions via Docker containers.

## 🚀 Build & Deployment Flow

When a candidate connects their GitHub repository and submits an assignment:

1. **Webhook Trigger**: A queue job is triggered by the submission or by subsequent pushes to the GitHub repository.
2. **Pipeline Execution**: The native server-side pipeline worker sequentially:
   - Clones the repository using native git commands via `child_process`.
   - Validates the project (ensuring it's a Next.js or supported app).
   - Installs dependencies using detected package managers (pnpm/npm/yarn).
   - Runs the build command.
   - Deploys the project.
3. **Deployment Modes**:
   - **Docker Mode**: Dynamically generates a `.Dockerfile`, builds a container for the app, and runs it securely. Previews are exposed via host ports or subdomains dynamically configured via a reverse proxy (Traefik labels injected during Docker run).
   - **Simulated Mode**: Captures build logs without actively firing up a Docker container, used for preliminary checks or environments lacking full Docker capability.
4. **Log Streaming**: The build logs (`stdout`/`stderr`) are captured natively in real-time and stored in Postgres. Employers and candidates can view these streaming logs through their respective dashboards logically presented inside intuitive dialog modals.

## 🧠 How Evaluation Works

Evaluation heavily leverages the built-in AI pipeline:

1. **Context Extraction**: After a successful build (or a failed build after cloning), the pipeline triggers the `analyze` stage.
2. **Intelligent Sampling**: The platform extracts key metadata (`package.json`, top-level structure). To provide a comprehensive view, source files are selected by intelligently distributing the sampling across different top-level directories (e.g., `components`, `app`, `services`), rather than just picking the first files encountered. This ensures the LLM receives a representative view of the entire codebase.
3. **AI Generation**: A structured prompt is sent to the LLM (e.g., Gemini) asking it to evaluate:
   - Overall project overview.
   - Notable changes and structure.
   - Engineering strengths.
   - Risks or concerns.
   - Suggested follow-up interview questions.
4. **Fallbacks**: If AI generation fails, deterministic fallback content is preserved. The employer reviews detailed, qualitative insights rather than arbitrary black-box numeric scores.

## 💬 How AI Q&A Works

Employers can interact directly with the repository via the AI Q&A thread in their dashboard using a responsive chat interface:

1. **Context-Aware Chat**: When reviewing an AI report (via a dialog modal on the dashboard), the employer can send free-form follow-up questions.
2. **Grounded Answers**: The API merges the specific repository context, the existing AI report, and the previous Q&A history.
3. **Conversational Insights**: The backend passes this structured history to the LLM to provide precise, code-grounded answers. This creates an insightful, deeply interactive code review session.

## 🛠️ Step-by-step Instructions to Test the Platform

### 1. Requirements
- Node.js (v20+ recommended)
- `pnpm` (Workspace enabled)
- Docker & Docker Compose (for Postgres, Traefik, and pipeline deployment support)

### 2. Environment Setup
Create the required `.env` files from their respective examples:
- Copy `.env.example` in `apps/api/` to `.env` and fill in necessary secrets:
  - `BETTER_AUTH_SECRET`
  - `GEMINI_API_KEY` (For AI Evaluation / Code Analysis)
  - `GITHUB_APP_*` secrets (Required if testing GitHub App integration).
- Copy other `.env.example` files as applicable across packages & web.
- Run `pnpm install` at the root.

### 3. Start Database & Services
Run the local Postgres service securely via Docker:
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
