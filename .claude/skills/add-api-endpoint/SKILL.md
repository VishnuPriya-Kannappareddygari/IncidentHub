---
name: add-api-endpoint
description: Add or change a backend endpoint in IncidentHub following its routes -> controllers -> services -> Prisma layering with zod validation. Use when adding an API feature.
---

# Add an API endpoint

1. Zod schema in `server/src/validators/index.js`; apply with `middleware/validate.js`.
2. Business logic in `server/src/services/<area>.service.js` using the single Prisma client from `lib/prisma.js`.
3. Optional controller in `controllers/`; route in `routes/<area>.routes.js` wrapped in `async-handler`, guarded with the role middleware from `middleware/auth.js` (ADMIN, RESPONDER, REPORTER).
4. Mount under `/api/v1` in `server/src/app.js` if it is a new router.
5. Throw errors from `lib/errors.js`; the error handler returns `{ error: { code, message, details } }`.
6. Record audit/activity via `lib/audit.js` / `activity.service.js` for state changes.
7. Client: add a function in the matching `client/src/api/*.js` module (all calls go through `api/http.js`).
8. Schema change? `npx prisma migrate dev` on the dev DB only, with user approval.
9. Run `npm run lint` in server (only `node --check`) and add an API test in `tests/api/`.
