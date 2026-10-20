# PrepPilot — AI-Powered Study & Interview Preparation System

PrepPilot helps college students turn raw study material into an **adaptive** preparation plan: it tracks what
you've studied, detects knowledge gaps with a transparent scoring formula, builds a study schedule that respects
your real availability, quizzes you, recommends revision, and runs AI-evaluated mock interviews — then rolls all
of it up into academic / interview / overall readiness scores.

It is not a timetable generator. Every recommendation is explainable: priority scores, revision recommendations,
and readiness scores are computed by deterministic, documented formulas — never by an opaque model and never
randomly.

## Features

- **Auth**: signup, login, logout, forgot/reset password, session persistence, protected routes.
- **Onboarding**: a 6-step wizard (personal, academic, subjects, skills, career target, study preferences), fully skippable.
- **Subjects & Topics**: full CRUD, status tracking (Not started / In progress / Completed / Needs revision), confidence rating.
- **Knowledge Gap Analysis**: a weighted, transparent 0–100 priority score per topic (incompleteness, quiz weakness, importance, interview relevance, deadline urgency, confidence gap) with the contributing reasons shown in the UI.
- **Study Planner**: generates a day-by-day schedule from your dates/hours/study-days that never overlaps tasks or exceeds your daily budget; clearly reports when the requested workload doesn't fit instead of silently dropping items.
- **Adaptive Planning**: completing a task nudges the topic forward; missed tasks are automatically rescheduled into the next day with spare capacity (protecting the plan's end date); a weak quiz score raises a topic's priority and creates a revision recommendation automatically.
- **Quiz System**: quiz a topic, a subject, your weak topics, or a mixed review; server-side scoring; double-submission is rejected; results show explanations and weak topics.
- **Revision Engine**: recommends revision based on quiz scores, confidence, explicit status, and staleness, with a plain-language reason for each recommendation.
- **Interview Preparation**: generate technical / HR / behavioral / project questions for a target role and difficulty; practice answers are AI-evaluated (or deterministically scored in offline mode).
- **AI Mock Interviews**: pick a role/type/difficulty/question count, answer one question at a time, and get a full report (overall score, strengths, weaknesses, recommended topics, suggested improvements).
- **Readiness Scores**: academic, interview, and overall readiness (0–100), each broken down into the factors that produced it, plus a history trend.
- **Analytics**: subject progress, quiz performance, readiness trend chart, with real empty states for new users (no misleading charts on no data).
- **AI Assistant**: a chat panel grounded in your real data (priorities, revision list, readiness) — it says so explicitly if it doesn't have the information, rather than inventing progress.
- **AI abstraction with safe fallback**: every AI-backed feature works out of the box in a deterministic mock/demo mode. Set `AI_PROVIDER=anthropic` and `AI_API_KEY` to use a real model; any provider failure falls back to the deterministic bank automatically and reports which one actually answered.

## Architecture

```
/src              React 19 + TypeScript + Vite + Tailwind CSS frontend
  /components     Shared UI primitives (Button, Card, Fields, Toast, RouteGuards, ...)
  /features       Feature-scoped UI (academics forms, onboarding steps)
  /hooks          useAuth, useTheme
  /layouts        AppLayout (sidebar shell), AuthLayout
  /pages          One component per route
  /services       TanStack Query hooks — the only place the frontend talks to the API
  /lib            api client, class-name helpers, form-error helpers, nav config

/server           Node.js + TypeScript + Express backend
  /routes         Thin HTTP layer: parse/validate input (Zod), call a service, shape the response
  /services       All business logic: priority engine, planner, quiz, interview, readiness, AI abstraction
  /middleware     Session auth, centralized error handling, security headers, rate limiting
  /db             Drizzle ORM schema, migrations, seed script
  /utils          Password hashing, typed error helpers

/shared           Code and types imported by BOTH client and server (Zod schemas, DTOs, the
                  priority-scoring engine, and the study-plan generator). These two engines are
                  pure functions with no DB/HTTP dependency, so they're unit-tested in isolation.

/tests            Vitest: integration tests (supertest against the real Express app + Postgres)
                  and pure unit tests for the priority engine and planner.
```

### Why some logic lives in `/shared`
The priority-scoring formula (`shared/priority.ts`) and the study-plan generator (`shared/planner.ts`) are
deliberately framework-free, side-effect-free functions. That makes them:
- **Deterministic and testable** without a database (see `tests/priority.test.ts`, `tests/planner.test.ts`).
- **Explainable**: every point in a priority score is attributed to a named factor with a human-readable reason.
- **Not AI**: per the project's ground rules, numerical scoring is a transparent weighted formula, not an LLM guess.

### The AI service abstraction
`server/services/aiService.ts` exposes one interface (`generateQuizQuestions`, `generateInterviewQuestions`,
`evaluateInterviewAnswer`, `chat`) with two implementations:
- **Mock provider** (default): deterministic, seed-based generation and heuristic scoring. No network calls.
- **Anthropic provider**: real calls to `api.anthropic.com` when `AI_PROVIDER=anthropic` and `AI_API_KEY` is set.

Every call goes through a fallback wrapper: if the real provider throws (network error, bad JSON, timeout), the
mock provider answers instead, and the response is tagged `source: "FALLBACK_BANK"` vs `"AI"` end-to-end (stored
in the database, returned to the client) — the app never claims a successful AI response that didn't happen.

## Tech stack

- **Frontend**: React 19, TypeScript (strict), Vite, Tailwind CSS, React Router, TanStack Query, Recharts, lucide-react
- **Backend**: Node.js, TypeScript, Express 5
- **Database**: PostgreSQL, Drizzle ORM (typed schema + migrations)
- **Auth**: cookie-based sessions (bcrypt-hashed passwords, httpOnly session cookie), CSRF-safe same-origin fetch
- **Testing**: Vitest + Supertest (integration tests against a real Postgres test database) and pure unit tests

## ⚠️ This is a full-stack app — you can't just open a file in your browser

PrepPilot has real user accounts, a database, and a backend API. Double-clicking `index.html` (or any file in
this project) will show a blank page — browsers can't run TypeScript directly, and there's no server behind
the page to talk to. You need to actually **run** it with the steps below. It takes about 5 minutes.

## Prerequisites

- **Node.js 20 or later** — check with `node -v`. If you don't have it, install from https://nodejs.org (choose the LTS version).
- **A PostgreSQL database.** Two ways to get one, pick whichever is easier for you:
  - **Docker (recommended, no manual Postgres setup)** — install Docker Desktop from https://www.docker.com/products/docker-desktop, then use the `docker-compose.yml` included in this project (see below).
  - **A local PostgreSQL install** — https://www.postgresql.org/download — if you'd rather not use Docker.

## Quick start (Docker)

Run these commands from inside the unzipped project folder (the one with `package.json` in it):

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# The default .env.example values already match docker-compose.yml below, so on Mac/Linux you can
# use it as-is. On Windows, copy it manually in File Explorer or run: copy .env.example .env

# 3. Start PostgreSQL in the background (via Docker)
docker compose up -d
# First run only: wait ~10 seconds for Postgres to finish starting before continuing.

# 4. Create the database tables
npm run db:migrate

# 5. (Optional but recommended) Load a realistic demo account
npm run db:seed
# Creates: alex@example.com / Str0ngPassw0rd

# 6. Start the app
npm run dev
```

Now open **http://localhost:5173** in your browser — that's the real running app.

To stop everything later: press `Ctrl+C` in the terminal running `npm run dev`, then `docker compose down`
(add `-v` to also delete the database data and start fresh next time).

## Quick start (without Docker)

If you installed PostgreSQL directly instead of using Docker:

```bash
npm install
cp .env.example .env
# Edit .env: replace DATABASE_URL / TEST_DATABASE_URL with your own Postgres username/password.

# Create the two databases PrepPilot needs (one for the app, one for automated tests)
createdb preppilot
createdb preppilot_test

npm run db:migrate
npm run db:seed      # optional demo account
npm run dev
```

Open **http://localhost:5173**.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | API port, defaults to 4000 |
| `APP_URL` | yes | Public URL of the web app (CSRF origin check, password-reset links) |
| `DATABASE_URL` | yes | PostgreSQL connection string for the app database |
| `TEST_DATABASE_URL` | for `npm test` | **Must be a different database** — the test suite truncates it between tests |
| `SESSION_TTL_DAYS` | no | Session lifetime, defaults to 14 |
| `AI_PROVIDER` | no | `mock` (default, offline deterministic) \| `anthropic` \| `openai` (currently falls back to mock) |
| `AI_API_KEY` | only if `AI_PROVIDER=anthropic` | Server-side only — never sent to the browser |
| `AI_MODEL` | no | Defaults to `claude-3-5-haiku-latest` when using the Anthropic provider |

If `AI_PROVIDER`/`AI_API_KEY` are missing or invalid, the app runs entirely in deterministic mock mode — every
AI-backed feature still works, and results are clearly tagged as coming from the fallback bank.

## Seed data

```bash
npm run db:seed
```

This creates a demo student, **Alex Johnson** (`alex@example.com` / `Str0ngPassw0rd`), with:
- 4 subjects (Data Structures, DBMS, Operating Systems, Computer Networks) and 11 topics across them, with a realistic mix of completed / in-progress / needs-revision / not-started topics, confidence ratings, and quiz scores
- A submitted quiz on the weak topic ("Normalization", 48%) and the resulting active revision recommendation
- An active study plan with completed and pending tasks
- Practice interview questions with a recorded answer, and one **completed** mock interview with a full report
- An initial readiness snapshot

Re-running `npm run db:seed` is safe — it deletes and recreates only Alex's account.

## Running locally

```bash
npm run dev
```

This starts the Express API (port 4000, via `tsx watch`) and the Vite dev server (port 5173) together, with the
Vite dev server proxying `/api` to Express. Open http://localhost:5173.

## Troubleshooting

- **Blank page / "cannot connect" errors in the browser console**: the backend isn't running or can't reach Postgres. Make sure `docker compose up -d` (or your local Postgres service) is running, then restart `npm run dev`.
- **`ECONNREFUSED` or `password authentication failed` on startup**: your `.env` database credentials don't match your actual Postgres setup. If using Docker, make sure you didn't change the credentials in one file without the other.
- **Port already in use**: something else is using 5173 or 4000. Stop it, or change `PORT` in `.env` (and the Vite port in `vite.config.ts`).
- **`docker compose` command not found**: older Docker installs use `docker-compose` (with a hyphen) instead — try that.

## Testing

```bash
npm test          # runs the full Vitest suite once (uses TEST_DATABASE_URL, truncates it)
npm run test:watch
```

The suite includes:
- Integration tests (Supertest against the real Express app + a real Postgres test database) for auth, subjects/topics, quizzes, revision, interview questions, mock interviews, the study planner, and readiness — with explicit **cross-user data isolation** tests on every resource type.
- Pure unit tests for the priority-scoring engine and the study-plan generator (no database needed).

## Type checking, linting, production build

```bash
npm run typecheck   # tsc --noEmit for both the client and server tsconfigs
npm run lint        # eslint .
npm run build       # typecheck + Vite client build + esbuild server bundle
npm start           # run the production server bundle (dist-server/index.js)
```

## AI provider configuration

By default (`AI_PROVIDER=mock`), no external calls are made — quiz questions, interview questions, and answer
evaluation are generated deterministically. To use a real model:

```
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-3-5-haiku-latest   # optional, this is the default
```

The API key is read only on the server (`server/config/env.ts`) and is never bundled into client code or sent
to the browser.

## Known limitations

- The `openai` provider is accepted by the schema but not yet implemented; it currently falls back to the deterministic mock provider.
- Short-answer quiz/interview grading uses a lightweight keyword-overlap heuristic in mock mode rather than true natural-language understanding; a real AI provider gives materially better grading.
- The study planner assumes a single contiguous study block per day starting at 6 PM by default; it does not yet split a long topic across multiple time-of-day sessions.
- Notifications and email delivery (password reset) are implemented server-side but rendered as console/log output in local development rather than sent through a real email provider.
