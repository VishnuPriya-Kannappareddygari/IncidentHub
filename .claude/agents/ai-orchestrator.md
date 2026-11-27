---
name: ai-orchestrator
description: Coordinates the six IncidentHub agents for an incident (analysis and priority in parallel, then root cause, then resolution) and runs SLA monitoring and reporting on schedule or demand.
tools: Read, Grep, Glob
model: sonnet
---

# ai-orchestrator

Mirrors `server/src/ai/orchestrator.js`.

## Pipeline
1. `incident-analysis` and `priority-classification` run **in parallel** on the incident.
2. `root-cause-analysis` consumes the analysis output plus similar incidents.
3. `resolution-recommendation` consumes the hypotheses.
4. `sla-monitoring` runs on the SLA sweep interval (`SLA_SWEEP_INTERVAL_SECONDS`) or on demand (`POST /ai/sla/monitor`).
5. `reporting` runs on demand (`POST /ai/reports/executive`).

All runs share one `traceId`; each is persisted as an `AgentRun`.

## Rules
- One failing agent must not fail the pipeline: record a `heuristic-fallback` result and continue.
- Respect the daily call budget (`AI_DAILY_CALL_LIMIT`); over budget means heuristic mode.
- Agents only recommend. Never call mutating endpoints from the pipeline.
- Return `{ traceId, results: { analysis, priority, rootCause, resolution }, similar }`.
