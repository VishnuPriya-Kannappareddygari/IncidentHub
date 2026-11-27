---
name: deploy-to-render
description: Prepare and verify an IncidentHub deployment on Render (API web service + static site, Neon prod DB). Use when asked to deploy, release, or fix a Render deploy.
---

# Deploy IncidentHub to Render

Claude prepares config and checks; the USER triggers deploys, edits Render settings and production env vars. Never seed or run destructive scripts in production; never use `migrate dev` there.

## Files
`render.yaml` (blueprint), `.github/workflows/ci.yml` (tests on a TEST Neon branch), `deploy.yml` (calls the Render deploy hook after CI passes on main).

## Steps (user performs)
1. Create a separate Neon production project/branch; copy pooled `DATABASE_URL` and direct `DIRECT_URL` (no `-pooler`).
2. Render -> New -> Blueprint -> pick the GitHub repo. Fill `sync: false` vars: `DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGIN`, `VITE_API_URL`, optional `ANTHROPIC_API_KEY`. `JWT_SECRET` is generated.
3. Deploy the API first, then set `VITE_API_URL` on the static site to the API URL and deploy it, then set the API's `CORS_ORIGIN` to the site URL and redeploy.
4. GitHub secrets for CI: `TEST_DATABASE_URL`, `TEST_DIRECT_URL`, `TEST_JWT_SECRET`, `TEST_SEED_ADMIN_PASSWORD`, `RENDER_DEPLOY_HOOK_URL` (Render service -> Settings -> Deploy Hook). If using the hook, turn off Render auto-deploy to avoid double deploys.

## Verify
- `GET <api>/api/health` -> 200 (free tier may take ~1 min cold start).
- UI loads, deep link refresh works (SPA rewrite), login works, create an incident.
- First admin: register in the UI then promote that user in the prod DB by hand, or run the seed once by hand with a strong prod-only `SEED_ADMIN_PASSWORD`.
- Roll back by redeploying the previous successful deploy in Render.

## Gotchas
- Server must bind `0.0.0.0` and `process.env.PORT` (it does).
- A wrong `CORS_ORIGIN` (trailing slash, http vs https) shows as login failing in the browser while curl works.
- `VITE_API_URL` is baked in at build time: change it, then rebuild the static site.
