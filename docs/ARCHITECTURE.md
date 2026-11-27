# IncidentHub Architecture

AI-powered IT service management: React client, Express API, Neon PostgreSQL via Prisma, six Claude agents with a heuristic fallback, an SLA sweeper, and governance, observability and evaluation layers.

## 1. System context

```mermaid
flowchart LR
  U[Reporter / Responder / Admin] --> C[React client - Render static site]
  C -->|REST /api/v1| A[Express API - Render web service]
  A --> P[(Neon PostgreSQL)]
  A -->|fetch, redacted prompts| L[Anthropic Messages API]
  S[SLA sweeper in API process] --> P
  CC[Claude Code + subagents + hooks] -.->|read-only SQL| N[Neon MCP]
  CC -.->|browser tests| PW[Playwright MCP]
  GH[GitHub Actions CI] --> A
```

## 2. Backend layering

```mermaid
flowchart TB
  R[routes] --> M[middleware: auth, role, validate, rate limit]
  M --> CT[controllers: HTTP only]
  CT --> SV[services: business logic]
  SV --> PR[(Prisma / Neon)]
  SV --> AI[ai/: orchestrator, agents, governance, observability, similarity]
  AI --> LLM[llm.js - Claude via fetch]
  AI --> PR
  SW[sla sweeper] --> SV
  EH[error handler] -.-> CT
```

## 3. AI orchestration sequence

```mermaid
sequenceDiagram
  participant UI as Client
  participant API as ai.controller
  participant O as Orchestrator
  participant G as Governance
  participant A as Agents
  participant L as Claude
  participant DB as Neon
  UI->>API: POST /ai/incidents/:id/analyze
  API->>O: run(incident, user)
  O->>DB: load incident, similar incidents
  par analysis and priority
    O->>A: incident-analysis
    O->>A: priority-classification
  end
  O->>A: root-cause-analysis (analysis + similar)
  O->>A: resolution-recommendation (hypotheses)
  A->>G: redact, detect injection, check budget
  G-->>A: safe prompt or heuristic mode
  A->>L: call (timeout) or heuristic
  L-->>A: JSON
  A->>G: validate + clamp output
  A->>DB: persist AgentRun (traceId)
  O-->>UI: traceId, results, similar
```

SLA monitoring runs on the sweeper schedule or `POST /ai/sla/monitor`; reporting runs on `POST /ai/reports/executive`.

## 4. Data model

```mermaid
erDiagram
  USER ||--o{ INCIDENT : reports
  USER ||--o{ INCIDENT : assigned
  USER }o--o| TEAM : member
  TEAM ||--o{ INCIDENT : owns
  ASSET ||--o{ INCIDENT : affected
  INCIDENT ||--o{ COMMENT : has
  INCIDENT ||--o{ INCIDENT_EVENT : history
  INCIDENT ||--o{ AGENT_RUN : analysed_by
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ AUDIT_LOG : acts
  AGENT_EVAL_RUN {
    string id
    json results
  }
  INCIDENT {
    int id
    enum status
    enum severity
    string category
    datetime responseDueAt
    datetime resolveDueAt
    int escalationLevel
    string rootCause
  }
  AGENT_RUN {
    string traceId
    string agent
    string source
    int latencyMs
  }
```

## 5. SLA and escalation flow

```mermaid
stateDiagram-v2
  [*] --> Healthy: incident created, due dates set
  Healthy --> AtRisk: >= 75% of window elapsed
  AtRisk --> Breached: window exceeded
  Healthy --> Met: acknowledged / resolved in time
  AtRisk --> Met: acknowledged / resolved in time
  Breached --> Escalated1: auto, notify responders
  Escalated1 --> Escalated2: still breached or manual, notify admins
  Escalated2 --> Escalated3: still breached or manual, admins + reporter
  Escalated3 --> [*]: max level, further escalate returns 409
  Met --> [*]
```

## 6. Governance controls

```mermaid
flowchart LR
  IN[Incident text] --> RD[PII / secret redaction]
  RD --> INJ[Injection detection + data delimiters]
  INJ --> BUD{Budget and AI_ENABLED?}
  BUD -- no --> H[Heuristic agent]
  BUD -- yes --> CL[Claude call with timeout]
  CL -- error / timeout --> H
  CL --> VAL[Schema validation + clamping]
  VAL -- invalid --> H
  VAL --> REC[Recommendation only]
  H --> REC
  REC --> AUD[(AgentRun audit)]
  REC --> HUM[Human applies via PATCH]
```

## 7. Observability and evaluation loop

```mermaid
flowchart LR
  RUN[Agent runs] --> OBS[observability.js: traceId, latency, tokens, source]
  RUN --> AR[(AgentRun)]
  FB[User feedback] --> AR
  OBS --> DASH[GET /ai/observability]
  EV[evals/cases.js] --> ER[evals/runner.js]
  ER --> AE[(AgentEvalRun)]
  AE --> DASH2[GET /ai/evals]
  DASH2 --> FIX[Improve agents / cases]
  FIX --> RUN
```

## Claude Code layer

`.claude/agents` (six agents, orchestrator, evaluator), `.claude/skills` (triage, RCA, SLA review, evaluation, reporting), `.claude/hooks` (guard-bash, protect-secrets, post-edit-check, audit-log) and `.mcp.json` (Neon, Playwright). See SKILL.md sections 5 and 16.
