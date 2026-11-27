---
name: deploy-to-render
description: Deploy IncidentHub as ONE service (Docker image: Express serves API + built React UI) on Render or any Docker host, with a Neon prod DB. Use when asked to deploy, release, or fix a deploy.
---

# Deploy IncidentHub (single service)

The root `Dockerfile` builds `client/` (with `VITE_API_URL=""` = same origin) and runs `prisma migrate deploy && node src/index.js` in `server/`. Express serves `client/dist` plus an SPA fallback, so there is no CORS or API-URL wiring. Claude prepares config; the USER creates services, edits host settings and prod env vars. Never seed or run destructive scripts in prod; never use `migrate dev` there.

## Required env vars on the host
`DATABASE_URL` (Neon pooled, prod branch), `DIRECT_URL` (no `-pooler`), `JWT_SECRET` (random hex), optional `ANTHROPIC_API_KEY`. `PORT` is injected by the host. `NODE_ENV=production` is set in the image.

## Any Docker host (Render, Koyeb, Railway, Fly, HF Spaces)
Point the host at the GitHub repo + `Dockerfile` at the repo root, set the env vars above, health check `/api/health`. Host must route to the port the server reads from `PORT` (default 4000).

## Verify
- `GET /api/health` -> 200; `/` and a deep link like `/incidents` return the UI; login works.
- First admin: register in the UI, then promote that user in the prod DB by hand (or run the seed once by hand with a strong prod-only `SEED_ADMIN_PASSWORD`).
- Roll back by redeploying the previous successful deploy.

## Gotchas
- Free tiers sleep when idle: first request is slow (and the SLA sweeper pauses while asleep).
- Image build was not verified with Docker locally; the single-service serving was tested with `node` against the test DB.
- Changing `VITE_API_URL` is no longer needed; leave it unset in the Docker build.
