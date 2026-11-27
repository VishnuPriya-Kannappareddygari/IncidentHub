---
name: incident-triage
description: Triage a new IncidentHub incident: run AI triage, confirm severity, assign owner, acknowledge. Use when asked to triage or prioritise incidents.
---

# Incident triage

1. `POST /api/v1/ai/triage` with title/description for analysis + priority (+ similar incidents). Heuristic results work without an API key.
2. Check `flags` (prompt-injection, redaction) and `source`.
3. Compare suggested severity with the reporter's; the responder decides. Apply via `PATCH /incidents/:id` (human step).
4. Assign a responder/team, then `POST /incidents/:id/acknowledge` to stop the response SLA clock.
5. Review `GET /incidents/:id/similar` for duplicates and prior fixes.
Never auto-apply AI output; record the reasoning in a comment.
