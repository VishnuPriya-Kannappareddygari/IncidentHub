# IncidentHub

AI-powered IT service management platform: React (Vite) + Express + Prisma + Neon PostgreSQL, with six specialized Claude agents. See `SKILL.md` (project rules) and `docs/ARCHITECTURE.md` (diagrams).

## Features
- Advanced dashboard and analytics; reports and CSV/JSON export
- AI incident assistance and summarization; root cause and resolution recommendations
- Six agents: incident analysis, priority classification, root cause analysis, resolution recommendation, SLA monitoring, reporting
- Incident lifecycle (OPEN, INVESTIGATING, MITIGATED, RESOLVED, CLOSED), acknowledge and escalation workflow (levels 1 to 3)
- SLA monitoring with at-risk and breach alerts; background sweeper
- Similar incident detection
- IT asset management; teams and users with roles (`ADMIN`, `RESPONDER`, `REPORTER`)
- Incident activity history and audit logs; in-app notifications
- Governance (redaction, injection defence, budget, human in the loop), observability and agent evaluation
- Claude Code skills, subagents, hooks, Neon MCP and Playwright MCP (`.claude/`, `.mcp.json`)

## Setup (first time)
```bash
cd server && cp .env.example .env      # fill in Neon URLs (pooled DATABASE_URL, direct DIRECT_URL)
npm install
npx prisma migrate dev --name ai_itsm  # schema changes; dev database only, needs explicit user approval
npm run db:seed                         # dev data: admin/responder/reporter @incidenthub.test
npm run dev                             # API on :4000 (also starts the SLA sweeper)

cd ../client && cp .env.example .env && npm install && npm run dev   # UI on :5173
```
Seed password comes from `SEED_ADMIN_PASSWORD` in `server/.env`.

## Environment (server)
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `NODE_ENV`, plus optional AI settings:
`ANTHROPIC_API_KEY` (optional), `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `AI_ENABLED`, `AI_DAILY_CALL_LIMIT` (500), `AI_TIMEOUT_MS` (20000), `SLA_SWEEP_INTERVAL_SECONDS` (60).

## AI behaviour
- **With `ANTHROPIC_API_KEY`**: agents call Claude (via `fetch`, no SDK) after PII/secret redaction and prompt-injection checks; output is schema-validated and clamped. Results carry `source: "claude"`.
- **Without a key** (or `AI_ENABLED=false`, over daily budget, timeout, invalid output): deterministic heuristic agents answer instead (`source: "heuristic"` or `"heuristic-fallback"`). The whole app works offline.
- Agents only recommend; people apply changes through the normal API. Every run is stored as an `AgentRun`.

## Scripts (server)
```bash
npm run dev          # API with watch
npm run db:seed
npm run eval         # offline agent evaluations (heuristic, no network)
npm run eval:live    # evaluations against Claude (needs ANTHROPIC_API_KEY)
```

## Tests
```bash
cd tests && npm install && npx playwright install chromium
API_URL=http://localhost:4000 npm run test:api    # point the API at a TEST database
```

## API (all under `/api/v1`, except `/api/health`)
- Auth: `POST /auth/register|login`, `GET /auth/me`
- Incidents: `GET|POST /incidents`, `GET|PATCH /incidents/:id`, `POST /incidents/:id/comments|acknowledge|escalate`, `GET /incidents/:id/similar`
- Assets: `GET|POST /assets`, `GET|PATCH|DELETE /assets/:id`
- Teams and users: `GET|POST /teams`, `GET|POST /users`, `PATCH /users/:id`, `PATCH /users/:id/role`
- SLA: `GET /sla/policies`, `GET /sla/status`, `POST /sla/check`
- Notifications: `GET /notifications`, `POST /notifications/read-all`, `PATCH /notifications/:id/read`
- Activity: `GET /activity`; Stats: `GET /stats`
- Reports: `GET /reports/summary`, `/reports/incidents.csv`, `/reports/sla.csv`, `/reports/incidents.json`
- AI: `GET /ai/agents`, `POST /ai/triage`, `POST /ai/incidents/:id/analyze`, `POST /ai/incidents/:id/agents/:agent`, `GET /ai/incidents/:id/runs`, `PATCH /ai/runs/:id/feedback`, `POST /ai/sla/monitor`, `POST /ai/reports/executive`, `GET /ai/observability`, `GET /ai/governance`, `POST /ai/evals/run`, `GET /ai/evals`

Errors: `{ "error": { "code", "message", "details" } }`.

## SLA policy (response / resolution minutes)
SEV1 15/240, SEV2 30/480, SEV3 120/1440, SEV4 480/4320. At risk at 75% elapsed; a breach escalates one level (max 3).
