---
name: sla-breach-review
description: Review SLA status, at-risk and breached incidents and escalate. Use for SLA monitoring or breach questions.
---

# SLA breach review

Policy minutes (response/resolve): SEV1 15/240, SEV2 30/480, SEV3 120/1440, SEV4 480/4320. At risk at >=75% elapsed. A breach auto-escalates one level (max 3): L1 responders, L2 admins, L3 admins + reporter.

1. `GET /api/v1/sla/status` for current states; `POST /sla/check` forces a sweep.
2. `POST /ai/sla/monitor` for narrative and escalation recommendations.
3. For stuck incidents: acknowledge, reassign, or `POST /incidents/:id/escalate {reason}` (409 at level 3 or closed).
4. Export with `GET /reports/sla.csv`.
