# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

IncidentHub is an AI-powered ITSM app: React (Vite) client, Express + Prisma API on Neon PostgreSQL, six Claude-backed agents. `SKILL.md` holds the full project rules (coding standards, git/PR conventions, bug-report template) and `README.md` has the API list and SLA policy table; read `SKILL.md` section 0 before acting. Key rules from it: do not install anything (`npm install`, `npx prisma ...`, `npx playwright install`) without explicit approval in that turn, never run writes against a non-dev/non-test database, and commit or push only when asked.

## Commands

Three independent npm packages (`server/`, `client/`, `tests/`); there is no root `package.json`.

```bash
# server (API on :4000, also starts the SLA sweeper)
cd server && npm run dev
npm run lint            # only `node --check` on src/index.js and src/app.js
npm run db:seed         # dev data; password from SEED_ADMIN_PASSWORD
npm run eval            # offline agent evals (heuristic, no network)
npm run eval:live       # evals against Claude (needs ANTHROPIC_API_KEY)

# client (UI on :5173; `npm run dev` auto-opens /designs)
cd client && npm run dev
npm run build           # no real linter: `npm run lint` is an echo

# tests (Playwright; needs API and, for e2e, client running, pointed at a TEST database)
cd tests && npm run test:api
npx playwright test --project=api api/incidents.spec.js -g "<test title>"   # single test
npx playwright test --project=e2e --headed                                  # watch e2e runs
```

Schema changes go through `npx prisma migrate dev` (dev DB only, needs approval); the datasource uses a pooled `DATABASE_URL` for runtime and a direct `DIRECT_URL` for migrations. Server env vars are read only in `server/src/config/env.js`, which throws at startup if `DATABASE_URL` or `JWT_SECRET` is missing.

`.github/workflows/` is currently empty and there is no `render.yaml`, although `SKILL.md` describes both as the intended CI/CD setup.

## Architecture

**Server layering** (`server/src`): `routes -> controllers -> services -> Prisma` (single client in `lib/prisma.js`). Business logic lives in `services/`; some features (e.g. AI, SLA, reports) have routes calling services directly. Request validation is zod in `validators/index.js` via `middleware/validate.js`; every error goes through `middleware/error-handler.js` and is returned as `{ error: { code, message, details } }`. `app.js` builds the Express app (exported for tests); `index.js` listens and starts the SLA sweeper from `services/sla.service.js`. All routes are under `/api/v1` except `/api/health`.

**AI subsystem** (`server/src/ai`) is the part that spans many files:
- `agents/*` each define a prompt, a zod output schema, and a deterministic `heuristic` function; `registry.js` lists them with role permissions.
- `agents/runner.js` `execute()` is the single execution path: role check -> input redaction/injection flags (`governance.js`) -> daily budget check -> Claude call (`llm.js`, plain `fetch`, no SDK) -> schema validation -> output sanitising -> on any failure fall back to the heuristic. Results carry `source: "claude" | "heuristic" | "heuristic-fallback"`, and every run is persisted as an `AgentRun` (`observability.js`).
- `orchestrator.js` runs the pipeline `[analysis || priority || similar-search] -> root cause -> resolution` under one `traceId`. Agents only recommend; applying changes always goes through normal incident endpoints (human in the loop).
- `evals/` holds eval cases and runner behind `npm run eval`. The app must work with no `ANTHROPIC_API_KEY`, so AI tests assert response shape, not wording.

**SLA/escalation**: policy minutes per severity are in `services/sla.service.js`; the background sweeper marks at-risk (75% elapsed) and breached incidents and escalates one level (max 3), creating notifications and audit/activity events.

**Client** (`client/src`): React Router in `App.jsx` with `RequireAuth` role gates (`ADMIN`, `RESPONDER`, `REPORTER`; staff = admin + responder). All API calls go through `api/http.js` (JWT in `localStorage`, base URL from `VITE_API_URL`), with one module per backend area in `api/`. Data loading uses the `useAsync` hook. Styling is a single plain `styles/app.css` (CSS variables, no CSS framework).

**Tests** (`tests/`): Playwright with two projects, `api` (request fixture, `API_URL`) and `e2e` (browser, `BASE_URL`); helpers in `tests/utils/api-helpers.js`.

**Design gallery**: `client/src/pages/Designs.jsx` (route `/designs`, no auth) shows Figma screen exports from `client/public/designs/<file>.png`; screens with no PNG fall back to a link to the Figma frame. Add a screen by dropping the PNG in with the filename listed in that file.

**Claude Code tooling** (`.claude/`): hooks (`guard-bash`, `protect-secrets`, `post-edit-check`, `audit-log`) run on tool calls via `settings.json`; subagents mirror the six AI agents plus an orchestrator and evaluator; project skills cover triage, root cause, SLA review, reporting and agent evals. `.mcp.json` configures the Neon (use read-only against the dev branch) and Playwright MCP servers.
