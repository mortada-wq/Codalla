# Plan: make Codalla work

Codalla is a single-user, personal AI coding IDE. It has **no authentication,
no billing, and no hosted-deploy config** — those were removed deliberately.
Every request is attributed to one implicit `local` user row that the API
creates lazily on first request.

## Current state (after cleanup)

- **Removed**: all auth code (JWT, bcrypt, login/register/forgot-password UI,
  profile panel, protected routes), Railway config, Emergent OAuth,
  test credentials, and unrelated repo content.
- **Working**: full workspace `pnpm run typecheck` and `pnpm run build` pass;
  `pnpm install --frozen-lockfile` passes; API server boots and serves
  `/api/healthz` without a database.
- **Data model**: unchanged apart from dropping auth-only tables/columns
  (`login_attempts`, `password_reset_tokens`, `password_hash`, `google_id`,
  `email_verified`). All data tables still key off `users.id` via the
  implicit `local` user.

## Phase 1 — run it locally (the only blocker is Postgres)

1. Start a PostgreSQL 15+ instance and set `DATABASE_URL`, e.g.
   `postgres://postgres:postgres@localhost:5432/codalla`.
2. Push the schema: `pnpm --filter @workspace/db run push`.
3. Start the API: `pnpm --filter @workspace/api-server run dev`
   (defaults to port 4000, matching the Vite proxy; override with `PORT`).
4. Start the frontend: `pnpm --filter @workspace/codalla run dev`
   and open the printed URL. The app loads straight into the Dashboard —
   no login.
5. In **Settings → API keys**, add a provider key (SiliconFlow / OpenRouter /
   RunPod / custom OpenAI-compatible). AI chat won't respond without one.
6. Create a project (optionally from a GitHub URL; private repos need a PAT
   in Settings → General → GitHub token) and open it in the editor.

## Phase 2 — make it robust

1. **Single-process serving**: have Express serve the built frontend
   (`artifacts/codalla/dist/public`) with an SPA fallback, so
   `build + start` of the api-server is the whole app. Removes the need for
   any proxy in production-like use.
2. **Smoke tests**: a script that boots the server against a scratch DB and
   exercises health, project CRUD, and settings round-trip. Wire it into a
   minimal GitHub Actions workflow (install → typecheck → build → smoke).
3. **Frontend bundle**: code-split Monaco and Recharts (the 1.1 MB chunk) via
   dynamic import / `manualChunks`.
4. **Error surfaces**: replace Express's default HTML error page with a JSON
   error handler; surface DB-connection failures as a friendly banner in the
   UI instead of failed queries.

## Phase 3 — product completeness (from the PRD, minus auth/billing)

1. Editor polish: file tree refresh after git operations, unsaved-change
   guards, diff view for AI-proposed edits.
2. AI actions: apply-patch flow end-to-end (proposal → review → write to
   disk → git commit).
3. Memory/criteria panels: verify round-trips against the API and prune dead
   endpoints from `openapi.yaml`, then re-run
   `pnpm --filter @workspace/api-spec run codegen`.
4. Usage tracking: verify token accounting per provider actually records on
   each AI call.

## Non-goals (removed on purpose — do not reintroduce casually)

- Authentication / multi-user (schema keeps `users` only as an FK anchor).
- Stripe billing.
- Railway or any specific hosting config; deployment is "run the api-server
  next to Postgres".
