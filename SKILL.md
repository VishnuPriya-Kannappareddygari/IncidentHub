---
name: incidenthub
description: Project guide for IncidentHub, an AI-powered IT service management (ITSM) platform (React + Node.js/Express + Neon PostgreSQL via Prisma) with six specialized Claude agents, SLA/escalation workflow, asset and team management, reports, governance, observability and agent evaluation. Covers structure, standards, AI orchestration, Claude Code skills/subagents/hooks, MCP (Neon, Playwright), testing, CI/CD and Render deployment. Follow it for all work in this repository.
---

# IncidentHub: Project Skill

IncidentHub is an AI-powered IT service management platform: users report incidents, AI agents analyse, prioritise, diagnose and recommend fixes, an SLA engine monitors deadlines and escalates breaches, and teams manage assets, users, notifications, reports and audit history.

## 0. Rules for Claude Code (read first)

1. **Do NOT install anything.** No `npm install`, `npx`, `pip`, `winget`, `choco`, global tools, browsers or MCP servers. Do not edit `package.json` dependencies and do not run `npx prisma ...` or `npx playwright install` unless the user explicitly approves in that turn. If a dependency is missing, tell the user what is needed and why, then stop and wait.
2. **Ask before** anything destructive or outward-facing: dropping or resetting databases, `prisma migrate reset`, force-pushing, deleting files or branches, deploying, or editing CI secrets.
3. **Never touch production data.** Development and tests use separate Neon branches or databases. Confirm the `DATABASE_URL` target before any command that writes.
4. **Never commit secrets.** `.env` files stay git-ignored. Only `.env.example` (with placeholder values) is committed. Never print secret values in output.
5. **Read before you write.** Inspect existing files and follow existing patterns before adding new ones. Prefer editing over creating files.
6. **Keep changes small and focused.** One concern per change. Do not refactor unrelated code.
7. **Verify your work.** Run the relevant existing lint/test scripts (if the tools are already installed) and report results honestly, including failures.
8. **Commit or push only when asked.** Use Conventional Commit messages (see section 6).
9. **Report faithfully.** If a step was skipped or a test failed, say so with the output.

## 1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, fetch/axios, CSS Modules or Tailwind (follow what exists) |
| Backend | Node.js, Express, REST JSON API |
| Database | Neon serverless PostgreSQL |
| ORM | Prisma (schema, migrations, client) |
| Testing | Playwright (UI/functional), Playwright `request` fixture (API), Vitest/Jest for unit tests if present |
| CI/CD | GitHub Actions |
| Hosting | Render (web service for API, static site for frontend) |
| AI runtime | Anthropic Messages API called with `fetch` (no SDK dependency), model from `ANTHROPIC_MODEL`; deterministic heuristic fallback when no key, disabled, over budget, or on error |
| AI tooling | Claude Code with project skills, subagents, hooks and MCP (Neon and Playwright servers) |

## 2. Project structure

```
IncidentHub/
├── SKILL.md                  # This file
├── README.md
├── docs/ARCHITECTURE.md      # Mermaid diagrams
├── .gitignore
├── .mcp.json                 # Project-scoped MCP configuration (no secrets)
├── .claude/
│   ├── settings.json         # Hooks + read-only permission allowlist
│   ├── hooks/                # guard-bash, protect-secrets, post-edit-check, audit-log (node, fail open)
│   ├── agents/               # 6 agent subagents + ai-orchestrator + agent-evaluator
│   ├── skills/               # incident-triage, root-cause-analysis, sla-breach-review, agent-evaluation, incident-reporting
│   └── logs/                 # tool-audit.jsonl (git-ignored)
├── .github/                  # workflows (ci.yml, deploy.yml), ISSUE_TEMPLATE, PR template
├── client/                   # React frontend
│   ├── index.html, vite.config.js, .env.example
│   └── src/ (main.jsx, App.jsx, api/, components/, pages/, hooks/, context/, utils/, styles/)
├── server/                   # Node.js backend
│   ├── .env.example
│   ├── prisma/ (schema.prisma, migrations/, seed.js)
│   ├── scripts/run-evals.js  # npm run eval | eval:live
│   └── src/
│       ├── index.js          # Process entry: starts server and SLA sweeper
│       ├── app.js            # Express app (exported for tests)
│       ├── config/           # env parsing and validation
│       ├── routes/ controllers/ validators/ middleware/
│       ├── services/         # incident, comment, user, stats, notification, sla, report, asset, team, activity, ai
│       ├── ai/
│       │   ├── llm.js            # Claude fetch client, timeout, JSON extraction
│       │   ├── governance.js     # redaction, injection detection, budget, schema clamping
│       │   ├── observability.js  # traces, latency, token/cost, source counters
│       │   ├── similarity.js     # similar incident detection
│       │   ├── orchestrator.js   # pipeline + traceId
│       │   ├── registry.js       # agent registry and metadata
│       │   ├── agents/           # incident-analysis, priority-classification, root-cause-analysis,
│       │   │                     # resolution-recommendation, sla-monitoring, reporting, knowledge, runner
│       │   └── evals/            # cases.js, runner.js
│       └── lib/prisma.js     # Single PrismaClient instance
├── tests/                    # Playwright
│   ├── playwright.config.js
│   ├── .env.example          # BASE_URL, API_URL, TEST_DATABASE_URL
│   ├── api/ e2e/ pages/ fixtures/ utils/
└── render.yaml               # Render blueprint (infrastructure as code)
```

If the real layout differs, follow the real layout and update this section.

## 3. Coding standards

### General
- JavaScript (ES modules) unless the project already uses TypeScript; do not mix without approval.
- `const` by default, no `var`, strict equality, async/await over raw promises.
- Small, single-purpose functions. Descriptive names. No dead code or commented-out blocks.
- Comments explain *why*, not *what*.
- Respect existing ESLint/Prettier config. Do not reformat unrelated lines.
- Naming: `camelCase` variables/functions, `PascalCase` React components and Prisma models, `kebab-case` for non-component files, `UPPER_SNAKE_CASE` for constants and env vars.

### React (client)
- Function components and hooks only. One component per file, file named after the component.
- Keep components presentational; move data fetching to hooks or `api/` modules.
- Handle loading, empty and error states for every data view.
- Forms are controlled; validate on the client but never rely on it.
- Accessibility: semantic HTML, labels for inputs, keyboard operable controls, alt text.
- Add stable `data-testid` attributes on key interactive elements for Playwright. Prefer role/label locators first.
- Never hard-code the API URL; use `import.meta.env.VITE_API_URL`.
- Never put secrets in client code. Everything prefixed `VITE_` is public.

### Node.js / Express (server)
- Layering: `routes -> controllers -> services -> Prisma`. No business logic in routes, no Prisma calls in controllers.
- Validate every request body/query/params at the boundary; reject unknown fields.
- Centralized error handler middleware; return consistent JSON errors:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
  ```
- Use correct HTTP status codes (200/201/204/400/401/403/404/409/422/500).
- REST conventions: plural nouns, `/api/v1/incidents`, `/api/v1/incidents/:id`, `/api/v1/incidents/:id/comments`. Support pagination (`page`, `pageSize`), filtering (`status`, `severity`, `assigneeId`) and sorting.
- Provide `GET /api/health` returning 200 (used by Render health checks and tests).
- Configure CORS with an explicit origin from `CORS_ORIGIN`; use `helmet` and rate limiting if already available.
- Never log secrets, tokens or full request bodies containing PII. Use structured logs.
- Read env vars only in `config/`; fail fast at startup if required vars are missing.
- Hash passwords (bcrypt/argon2), sign JWTs with an env secret, set sensible expirations.

### Prisma / database
- Single `PrismaClient` instance in `server/src/lib/prisma.js`.
- Models `PascalCase`, fields `camelCase`, map to `snake_case` tables with `@@map`/`@map` if convention exists.
- Every model has `id`, `createdAt`, `updatedAt`. Index foreign keys and frequently filtered columns (`status`, `severity`).
- Use enums for `Status` (OPEN, INVESTIGATING, MITIGATED, RESOLVED, CLOSED) and `Severity` (SEV1 to SEV4).
- Core models: `User` (teamId, isActive), `Team`, `Incident` (category, teamId, assetId, respondedAt, responseDueAt, resolveDueAt, slaWarnedAt, slaBreachedAt, escalationLevel, aiSummary, rootCause, resolutionNotes), `Comment`, `IncidentEvent` (actorId optional for system events), `Asset`, `Notification`, `AuditLog`, `AgentRun` (agent run audit trail), `AgentEvalRun` (evaluation results).
- Schema changes go through migrations only; never edit applied migration files and never hand-edit the database.
- Use transactions for multi-step writes. Select only needed fields. Avoid N+1 queries (use `include`/`select` deliberately).

### Git
- Branches: `feature/<short-name>`, `fix/<short-name>`, `chore/<short-name>`.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`.
- Small PRs with a description of what changed, why, and how it was tested.

## 4. Environment and configuration

Required variables (documented in `.env.example` files, never committed with real values):

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Neon **pooled** connection string (host contains `-pooler`) for runtime |
| `DIRECT_URL` | server | Neon **direct** connection string for Prisma migrations |
| `JWT_SECRET` | server | Token signing |
| `CORS_ORIGIN` | server | Allowed frontend origin |
| `PORT` | server | Provided by Render; default 4000 locally |
| `ANTHROPIC_API_KEY` | server | Optional. Unset means heuristic agents only. Never commit or log |
| `ANTHROPIC_MODEL` | server | Default `claude-sonnet-5-5` |
| `AI_ENABLED` | server | `false` forces heuristic mode |
| `AI_DAILY_CALL_LIMIT` | server | Daily Claude call budget, default 500 |
| `AI_TIMEOUT_MS` | server | Per-call timeout, default 20000 |
| `SLA_SWEEP_INTERVAL_SECONDS` | server | SLA sweeper period, default 60 |
| `NODE_ENV` | server | `development` / `test` / `production` |
| `VITE_API_URL` | client | Backend base URL |
| `BASE_URL`, `API_URL` | tests | Targets for Playwright |
| `TEST_DATABASE_URL` | tests | Dedicated throwaway Neon branch for tests |

Prisma datasource expects both URLs:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## 5. MCP configuration

MCP servers let Claude Code inspect the database and drive the browser. **Do not install them yourself.** If they are not configured, point the user to this section.

Project-scoped `.mcp.json` (committed; contains no secrets):

```json
{
  "mcpServers": {
    "neon": {
      "type": "http",
      "url": "https://mcp.neon.tech/mcp"
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Guidelines:
- Neon MCP authenticates via OAuth in the browser, or an API key supplied through the user's environment, never written into the file.
- Point the Neon MCP at the **development** project/branch. Use it for read-only inspection (schema, row counts, query plans) by default. Ask before running writes or schema changes through MCP.
- Prefer Prisma migrations over MCP-driven schema changes so history stays in the repo.
- Use Playwright MCP for exploratory debugging and reproducing bugs; codify findings as real Playwright tests under `tests/`.
- Verify configured servers with `claude mcp list` (read-only). Adding servers (`claude mcp add`) requires user approval.

## 6. Development workflow

1. **Understand**: restate the task, read relevant code, check for an existing issue.
2. **Branch**: `git switch -c feature/<name>` from an up-to-date `main` (only when asked to commit).
3. **Design first for non-trivial work**: data model change, endpoint contract, UI states.
4. **Implement in vertical slices**: Prisma schema -> migration -> service -> controller/route -> API client -> UI.
5. **Test as you go**: add or update API and functional tests with the change.
6. **Self-review**: read the diff, remove debug output, check for secrets, check error handling.
7. **Run checks** that are already available: lint, build, tests. Report outcomes.
8. **PR**: fill out the PR template; link the issue (`Closes #123`). CI must pass before merge.
9. **Merge to `main`** triggers the Render deploy. Verify the health endpoint afterward.

Local run (using already-installed tooling only):
```bash
# server
cd server && npm run dev        # API on http://localhost:4000
# client
cd client && npm run dev        # UI on http://localhost:5173
```

Database workflow (needs user approval to run because it modifies a database):
```bash
npx prisma migrate dev --name <change>   # create and apply migration (dev DB only)
npx prisma generate                       # regenerate client
npx prisma migrate deploy                 # apply migrations in CI/production
npx prisma db seed                        # seed dev/test data
```
Never run `migrate dev` or `migrate reset` against production.

## 7. Testing strategy

Test pyramid: many fast API/unit tests, focused functional UI flows, few full end-to-end journeys.

### Principles
- Tests run against a **dedicated test database** (separate Neon branch), never dev or production data.
- Each test creates its own data and cleans up; tests must be independent and runnable in any order and in parallel.
- No fixed sleeps. Use Playwright auto-waiting and web-first assertions (`await expect(locator).toBeVisible()`).
- Locator priority: `getByRole` > `getByLabel` > `getByText` > `getByTestId` > CSS (last resort).
- Use Page Object Models in `tests/pages/` and fixtures in `tests/fixtures/`. Keep assertions in tests, not page objects.
- Tag tests: `@smoke`, `@regression`, `@api`, `@e2e`; run smoke on every PR and full regression on `main`/nightly.
- When the user asks for headed browser runs, use `--headed`.

### API testing (Playwright `request` fixture)
- Location: `tests/api/`. No browser needed.
- AI endpoints must pass with no `ANTHROPIC_API_KEY` (assert on shape, not wording).
- Cover for each endpoint: success path, validation failures (400/422), auth failures (401/403), not found (404), conflict (409), pagination/filter/sort, and response schema (field presence and types).
- Verify side effects through follow-up requests (create -> get -> update -> delete).
- Example:
  ```js
  import { test, expect } from '@playwright/test';

  test('creates an incident @api', async ({ request }) => {
    const res = await request.post('/api/v1/incidents', {
      data: { title: 'DB latency spike', severity: 'SEV2', description: 'p95 > 2s' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ title: 'DB latency spike', status: 'OPEN' });
  });
  ```

### Functional / UI testing
Priority flows:
- Authentication (login, logout, protected routes)
- Create incident (valid, invalid, required fields)
- List: pagination, filter by status/severity, search, sort
- Incident detail: edit, change status, assign, add comment
- Status lifecycle transitions and audit trail
- Empty, loading and error states
- Responsive layout smoke check
- AI triage and analysis panel (works with heuristic fallback)
- SLA indicators, acknowledge and escalate flows, notifications
- Assets, teams and user management; reports and CSV export
- Governance: injection text is flagged, PII is redacted, reporters cannot reach admin AI endpoints

### Unit tests
- Services, validators and utils with mocked Prisma where a unit test framework already exists.

### Quality gates
- All smoke tests green on every PR; full suite green before release.
- New features and bug fixes require at least one test; a bug fix needs a regression test that fails before the fix.
- Flaky tests are bugs: investigate with traces, fix or quarantine with a linked issue. Never just add retries or sleeps.
- CI retries: at most 2, and retried passes are reported as flaky.

### Playwright config expectations
- `use.baseURL` from `BASE_URL`; separate projects for `api` and `e2e`.
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`.
- Reporters: `list` locally; `html` + `junit` in CI.
- `webServer` block starts the app for local runs when practical.

## 8. Bug reporting

When you find a bug (during tests, debugging or review), report it using this template (also stored in `.github/ISSUE_TEMPLATE/bug_report.md`):

```markdown
## Summary
One-line description.

## Environment
- Branch/commit:
- Environment: local | CI | staging | production
- Browser/OS (if UI):
- Node version:

## Steps to reproduce
1.
2.
3.

## Expected result

## Actual result

## Evidence
- Logs / stack trace:
- Screenshot / Playwright trace / video:
- Failing test name and file:

## Severity
SEV1 (outage/data loss) | SEV2 (major feature broken) | SEV3 (minor/workaround exists) | SEV4 (cosmetic)

## Suspected cause / notes
```

Rules:
- Reproduce first; include minimal steps and, ideally, a failing Playwright test.
- One bug per issue. Search for duplicates before filing.
- Label: `bug`, plus `area:frontend|backend|database|ci|deploy` and `severity:*`.
- Redact secrets and personal data in logs and screenshots.
- Creating issues with `gh issue create` is outward-facing: draft the report and get user confirmation first.
- On fix: reference the issue in the PR, add the regression test, and note root cause in the PR description.

## 9. Debugging guidelines

Method: **reproduce -> isolate -> hypothesize -> verify -> fix -> add regression test**. Do not guess-and-patch.

- **Read the actual error** and stack trace fully before changing code. Check the first error, not the last.
- **Isolate the layer**: call the API directly (curl or Playwright `request`) to separate frontend from backend problems; check the DB to separate backend from data problems.
- **Frontend**: browser console and Network tab, React state/props, check request URL (`VITE_API_URL`), CORS errors, and response shape mismatches.
- **Backend**: check server logs, validate inputs reaching the controller, confirm env vars loaded, confirm the correct DB is targeted.
- **Database/Prisma**: enable query logging (`log: ['query','error']`) temporarily in development; inspect with Neon MCP read-only queries; common issues:
  - Neon cold start or idle connection errors: retry, and use the pooled `DATABASE_URL` at runtime.
  - Migration failures: ensure `DIRECT_URL` is the non-pooled string.
  - Prisma client out of date after schema change: regenerate (needs approval).
  - `P2002` unique constraint, `P2025` record not found, `P2003` foreign key; map these to 409/404/400.
- **Playwright failures**: open the trace (`show-trace`), check screenshot/video, run the single test with `--headed` or `--debug`, look for race conditions, wrong locators, or shared test data. Fix the cause rather than raising timeouts.
- **CI-only failures**: compare Node version and env vars with local, download the artifacts (traces, reports), check for missing secrets or DB migration state.
- **Render failures**: read build and deploy logs first; check env vars, start command, `PORT` binding (`0.0.0.0`), and health check path.
- Remove all temporary logging and debug code before finishing.
- State the root cause and evidence in your summary; if unresolved, say what was ruled out.

## 10. GitHub CI/CD

### Workflow: `.github/workflows/ci.yml` (reference)
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
      JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
      CORS_ORIGIN: http://localhost:5173
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci --prefix server
      - run: npm ci --prefix client
      - run: npm ci --prefix tests
      - run: npx --prefix server prisma generate --schema server/prisma/schema.prisma
      - run: npx --prefix server prisma migrate deploy --schema server/prisma/schema.prisma
      - run: npm run lint --prefix server
      - run: npm run lint --prefix client
      - run: npm run build --prefix client
      - run: npx --prefix tests playwright install --with-deps chromium
      - run: npm test --prefix tests
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: |
            tests/playwright-report/
            tests/test-results/
          retention-days: 14
```
(Installs happen inside CI only. Claude must not run them locally without approval.)

### Pipeline rules
- PRs must pass lint, build, API tests and E2E smoke before merging.
- Protect `main`: require PR, passing checks and at least one review; no direct pushes.
- Secrets live in GitHub Actions secrets (`TEST_DATABASE_URL`, `TEST_DIRECT_URL`, `TEST_JWT_SECRET`, `RENDER_DEPLOY_HOOK_URL`). Never in the repo or in logs.
- CI uses a dedicated Neon test branch, never the production database.
- Always upload Playwright reports and traces as artifacts on failure.
- Pin action versions and Node version; use lockfiles (`npm ci`).
- Optional nightly scheduled workflow runs the full regression suite.

### CD
Render auto-deploys on push to `main` once CI is green (enable "Deploy after CI checks pass"), or `deploy.yml` calls the Render deploy hook after tests succeed.

## 11. Deployment on Render

### Services
| Service | Type | Root dir | Build | Start |
|---|---|---|---|---|
| `incidenthub-api` | Web Service (Node) | `server` | `npm ci && npx prisma generate && npx prisma migrate deploy` | `node src/index.js` |
| `incidenthub-web` | Static Site | `client` | `npm ci && npm run build` | publish dir `dist` |

Optional `render.yaml` blueprint:
```yaml
services:
  - type: web
    name: incidenthub-api
    runtime: node
    rootDir: server
    buildCommand: npm ci && npx prisma generate && npx prisma migrate deploy
    startCommand: node src/index.js
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: DIRECT_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: CORS_ORIGIN
        sync: false
  - type: web
    name: incidenthub-web
    runtime: static
    rootDir: client
    buildCommand: npm ci && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        sync: false
```

### Deployment instructions
1. Create the Neon production database; copy the pooled and direct connection strings.
2. In Render, create the services (or apply the blueprint) from the GitHub repo.
3. Set environment variables in the Render dashboard (`sync: false` values are entered manually).
4. Set `CORS_ORIGIN` to the static site URL and `VITE_API_URL` to the API URL.
5. Deploy. Migrations run in the build step via `prisma migrate deploy` (never `migrate dev`).
6. Verify: `GET <api-url>/api/health` returns 200, the UI loads, login works, and a smoke test passes against production.
7. Roll back from the Render dashboard (redeploy a previous successful deploy) if the smoke check fails. Migrations must be backward compatible so rollback is safe (expand then contract).

### Deployment rules for Claude
- Do not trigger deployments, change Render settings or edit production env vars. Prepare config files and instructions; the user performs the deploy.
- The server must bind to `process.env.PORT` on `0.0.0.0`.
- Free-tier Render services sleep when idle; allow for cold start in smoke checks.
- Never run seeds or destructive scripts in production.

## 12. AI agents and orchestration

Six specialized agents live in `server/src/ai/agents/`, each with a Claude implementation and a deterministic heuristic implementation, run through `runner.js` (governance, timeout, schema validation, fallback, `AgentRun` persistence).

| Agent | Output shape |
|---|---|
| incident-analysis | `{summary, keyPoints[], category, affectedSystems[], impact, confidence}` |
| priority-classification | `{severity, urgency, rationale, factors[], confidence}` |
| root-cause-analysis | `{hypotheses:[{cause, likelihood, evidence, verificationSteps[]}], confidence}` |
| resolution-recommendation | `{steps:[{order, action, risk, rollback}], preventiveActions[], estimatedMinutes, confidence}` |
| sla-monitoring | `{overall:{breached, atRisk, healthy}, items:[{incidentId, state, minutesRemaining, recommendation}], escalationRecommendations[], narrative}` |
| reporting | `{headline, narrative, highlights[], risks[], recommendations[]}` |

`knowledge.js` supplies shared domain knowledge (categories, keywords, playbooks) to heuristics and prompts.

Result envelope: `{agent, runId, traceId, source: 'claude'|'heuristic'|'heuristic-fallback', model, latencyMs, flags, output}`.

Orchestration (`orchestrator.js`): analysis and priority run in parallel, then root cause, then resolution; one `traceId` per pipeline; a failing agent degrades to `heuristic-fallback` without failing the pipeline. SLA monitoring runs on the sweeper schedule or on demand; reporting runs on demand. Similar-incident detection (`similarity.js`) feeds the pipeline.

Endpoints (`/api/v1/ai`): `GET /agents`, `POST /triage`, `POST /incidents/:id/analyze`, `POST /incidents/:id/agents/:agent`, `GET /incidents/:id/runs`, `PATCH /runs/:id/feedback`, `POST /sla/monitor`, `POST /reports/executive`, `GET /observability`, `GET /governance`, `POST /evals/run`, `GET /evals`.

Rules for changing agents: keep the output shape above stable (update validators, UI, subagent docs in `.claude/agents/`, and eval cases together); always keep a heuristic path; run evals (section 15).

## 13. Governance

- **Redaction**: PII and secrets (emails, tokens, keys, connection strings) are redacted before any text reaches the LLM.
- **Prompt-injection defence**: injection patterns are detected and flagged; incident text is wrapped in data delimiters and the system prompt states it is untrusted data.
- **Human in the loop**: agents recommend only. Applying severity, status, assignee or escalation is a normal authenticated API call by a person.
- **Role gating**: admin AI endpoints (evals, governance, observability) are role-restricted; reporters get limited access.
- **Budget**: `AI_DAILY_CALL_LIMIT`; over budget degrades to heuristics, not errors.
- **Output validation**: schema validation and clamping (confidence 0..1, enum values, array lengths); invalid output falls back to heuristics.
- **Audit trail**: every run is stored as `AgentRun` (redacted input, output, flags, source, latency, feedback); user actions go to `AuditLog` and `IncidentEvent`.
- **Fallback**: no key, `AI_ENABLED=false`, timeout or error yields a heuristic result with `source` set accordingly.
- Never log `ANTHROPIC_API_KEY` or raw prompts containing unredacted data.

## 14. Observability

`observability.js` records per-run `traceId`, agent, source, latency, token usage and estimated cost, error and fallback counts, and flags. `GET /ai/observability` exposes aggregates (calls by agent and source, latency percentiles, fallback rate, budget used, feedback ratings). Server logs are structured JSON with `traceId`; no secrets or bodies. Claude Code tool use is logged by `.claude/hooks/audit-log.mjs` (metadata only).

## 15. Agent evaluation

- `cd server && npm run eval`: offline heuristic evals (no network, no cost). `npm run eval:live`: with Claude; needs `ANTHROPIC_API_KEY` and user approval.
- Cases live in `server/src/ai/evals/cases.js`; `evals/runner.js` scores schema validity, severity/category accuracy, keyword coverage, injection and redaction behaviour; results are saved as `AgentEvalRun` (`GET /ai/evals`, `POST /ai/evals/run`).
- Any change to an agent, prompt, governance or similarity code requires an eval run; report pass rates honestly and never loosen a case just to pass.

## 16. Claude Code skills, subagents, hooks

- **Subagents** (`.claude/agents/`): the six agents plus `ai-orchestrator` and `agent-evaluator`. They are read-only, treat incident text as data, and recommend only.
- **Skills** (`.claude/skills/`): `incident-triage`, `root-cause-analysis`, `sla-breach-review`, `agent-evaluation`, `incident-reporting`.
- **Hooks** (`.claude/settings.json`, node scripts, fail open on malformed input): `guard-bash` (blocks migrate reset, prod schema pushes, force-push, recursive root deletes, package installs), `protect-secrets` (blocks real `.env` files, allows `.env.example`), `post-edit-check` (`node --check` on edited server JS), `audit-log` (metadata to `.claude/logs/tool-audit.jsonl`).
- **MCP**: Neon (read-only on the dev branch) and Playwright, per section 5. Subagents may use Neon read-only SQL only.

## 17. SLA and escalation rules

| Severity | Response (min) | Resolution (min) |
|---|---|---|
| SEV1 | 15 | 240 |
| SEV2 | 30 | 480 |
| SEV3 | 120 | 1440 |
| SEV4 | 480 | 4320 |

- Due dates are set at creation (`responseDueAt`, `resolveDueAt`) and recomputed when severity changes. Acknowledge (`POST /incidents/:id/acknowledge`) sets `respondedAt`.
- **At risk** at >= 75% of a window elapsed (notification, `slaWarnedAt`); **breached** at 100% (`slaBreachedAt`).
- A breach auto-escalates one level (max 3): L1 notifies responders, L2 admins, L3 admins and the reporter. Manual escalation: `POST /incidents/:id/escalate {reason}`; 409 at level 3 or when closed.
- The sweeper (`SLA_SWEEP_INTERVAL_SECONDS`) and `POST /sla/check` run the same idempotent logic. Incident responses include `sla: {response, resolution, overall}` and `escalationLevel`.
- Lifecycle: OPEN, INVESTIGATING, MITIGATED, RESOLVED, CLOSED with the transition map in `incident.service.js`; invalid moves return 409.

## 18. Feature map

| Feature | Backend | Frontend |
|---|---|---|
| Dashboard and analytics | `/stats`, `/reports/summary` | Dashboard |
| AI assistance and summarization | `/ai/*` | Incident detail AI panel |
| Lifecycle and escalation | `/incidents/*` | Incident detail |
| SLA monitoring and breach alerts | `/sla/*`, sweeper | SLA indicators, notifications |
| Root cause and resolution recommendations | `/ai/incidents/:id/agents/*` | Incident detail AI panel |
| Asset management | `/assets` | Assets page |
| Teams and users with roles | `/teams`, `/users` | Users and Teams pages |
| Activity history and logs | `/activity`, incident events | Activity page, timeline |
| Reports and export | `/reports/*` (csv, json) | Reports page |
| Notifications | `/notifications` | Notification bell |
| Similar incident detection | `/incidents/:id/similar` | Incident detail and report form |
| Governance, observability, evals | `/ai/governance`, `/ai/observability`, `/ai/evals` | AI admin page |

## 19. Definition of done

- [ ] Feature works for happy path and error paths (UI and API)
- [ ] Input validated server-side; errors use the standard format
- [ ] Prisma migration included if the schema changed; no edits to applied migrations
- [ ] API tests and functional tests added or updated; smoke suite passes
- [ ] Agent, prompt, governance or similarity changes: `npm run eval` run and results reported
- [ ] AI features work in heuristic mode (no API key) and keep governance controls intact
- [ ] Lint and build pass
- [ ] No secrets, debug logs, or dead code committed
- [ ] `.env.example`, SKILL.md, docs/ARCHITECTURE.md and README updated if config or architecture changed
- [ ] PR description explains what, why and how it was tested
- [ ] CI green; deploy verified via health check after merge

## 20. Quick reference: when unsure

- Missing tool or dependency: **stop and ask; do not install.**
- Unclear requirement: ask a focused question, or choose the conventional option and state it.
- Risky or irreversible action: confirm first.
- Conflict between this file and the user's current instruction: the user's instruction wins; mention the deviation.
