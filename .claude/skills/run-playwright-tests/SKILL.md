---
name: run-playwright-tests
description: Run IncidentHub's Playwright API and e2e suites against a TEST database. Use when asked to run tests or check nothing broke.
---

# Run Playwright tests

- Tests create data: the API must point at a TEST database/branch, never the dev data you care about. Confirm with the user first.
- One-time (needs approval): `cd tests && npm install && npx playwright install chromium`.
- API: start the server, then `cd tests && API_URL=http://localhost:4000 npm run test:api`.
- E2E (headed, per project convention): start API and client, then `cd tests && npx playwright test --project=e2e --headed` (`BASE_URL` defaults to the client).
- Single test: `npx playwright test --project=api api/incidents.spec.js -g "<title>"`.
- AI assertions check response shape, not wording, since the app runs without an API key.
- Report failures with the actual output; helpers live in `tests/utils/api-helpers.js`.
