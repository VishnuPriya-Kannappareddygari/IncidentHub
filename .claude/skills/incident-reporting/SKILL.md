---
name: incident-reporting
description: Produce incident and SLA reports and exports (summary, CSV, JSON, AI executive report).
---

# Incident reporting

- Metrics: `GET /api/v1/reports/summary`.
- Exports: `/reports/incidents.csv`, `/reports/incidents.json`, `/reports/sla.csv`.
- Executive narrative: `POST /ai/reports/executive` (headline, narrative, highlights, risks, recommendations).
- State period, source and AI mode (claude vs heuristic) in the report. Redact personal data when sharing.
