---
name: agent-evaluation
description: Run and extend the IncidentHub AI agent eval suite (npm run eval) and interpret results.
---

# Agent evaluation

- Offline: `cd server && npm run eval` (heuristic agents, no network). Live: `npm run eval:live` (needs ANTHROPIC_API_KEY; ask the user first).
- Output lists per-agent pass rate and failing cases; runs are stored as `AgentEvalRun` (`GET /api/v1/ai/evals`, `POST /ai/evals/run`).
- Add cases in `server/src/ai/evals/cases.js`: `{ id, agent, input, expect }` with expectations on severity, category, keywords or schema validity. Include prompt-injection and PII cases.
- Required after any change to an agent, prompt, governance or similarity code. Report pass rate before/after; never loosen expectations to pass.
