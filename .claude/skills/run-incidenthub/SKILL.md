---
name: run-incidenthub
description: Set up and run IncidentHub locally (Neon DB, Prisma, API on :4000, UI on :5173). Use when asked to run, start, restart or set up the app.
---

# Run IncidentHub

Three independent npm packages (`server/`, `client/`, `tests/`); no root package.json.

## First-time setup (needs explicit user approval for installs and DB writes; dev DB only)
1. `server/.env` from `.env.example`: `DATABASE_URL` (pooled, host has `-pooler`), `DIRECT_URL` (same string without `-pooler`), `JWT_SECRET` (random hex), `SEED_ADMIN_PASSWORD`. `ANTHROPIC_API_KEY` empty = heuristic agents. `client/.env`: `VITE_API_URL=http://localhost:4000`.
2. Write `.env` values with node, not `sed` (`&` in Neon URLs corrupts sed replacements).
3. `cd server && npm install && npx prisma generate && npx prisma migrate deploy && npm run db:seed`. `prisma generate` is required explicitly because npm blocks install scripts.
4. `cd client && npm install`.

## Run
- API: `cd server && npm run dev` (also starts the SLA sweeper). Check `curl localhost:4000/api/health` -> `{"status":"ok"}`.
- UI: `cd client && npx vite --no-open` (plain `npm run dev` opens /designs).
- Login: `admin@`, `responder@`, `reporter@incidenthub.test`; password is `SEED_ADMIN_PASSWORD`.

Never print or commit `.env` contents (credentials). Seed is upsert-based and safe to re-run.
