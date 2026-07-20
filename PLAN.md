# Plan: make Codalla work

Codalla is a team AI coding IDE with deliberately simple sign-in: **Google
OAuth only** — no passwords, no Clerk, no Firebase. Sessions are plain DB
rows behind an httpOnly cookie; team access is gated by an email-domain
allowlist. For solo development, `AUTH_DISABLED=true` skips sign-in and
attributes everything to one implicit `local` user. Billing and hosted-deploy
config remain out of scope.

## Google sign-in setup (one-time, ~5 minutes)

1. In Google Cloud Console → APIs & Services → Credentials, create an
   **OAuth client ID** of type "Web application".
2. Add `${APP_URL}/api/auth/google/callback` to Authorized redirect URIs
   (for dev: `http://localhost:5173/api/auth/google/callback`).
3. Set env on the API server: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   and `APP_URL`. Optionally gate access with
   `ALLOWED_EMAIL_DOMAINS=yourcompany.com` and/or
   `ALLOWED_EMAILS=a@x.com,b@y.com` — leave both unset to allow any
   Google account (open signup).
4. That's it — first sign-in creates the user row; revoke any session by
   deleting its row in the `sessions` table.

## Current state

- **Removed earlier**: password/JWT auth, Emergent OAuth, Stripe plans,
  Railway config, test credentials, and unrelated repo content.
- **Auth now**: Google-only OAuth (`google-auth-library`), DB-backed
  sessions, email-domain team gating, per-user data scoping on every route
  (verified: users only see their own projects/keys/usage).
- **Working**: full workspace `pnpm run typecheck` and `pnpm run build` pass;
  chat vibe-coding loop verified end-to-end in a real browser (streamed
  replies, file blocks, usage accounting); sign-in/sign-out lifecycle
  verified end-to-end with sessions revoked on logout.

## Phase 1 — run it

1. Start a PostgreSQL 15+ instance and set `DATABASE_URL`, e.g.
   `postgres://postgres:postgres@localhost:5432/codalla`.
2. Push the schema: `pnpm --filter @workspace/db run push`.
3. Configure Google sign-in (section above), or export `AUTH_DISABLED=true`
   to skip it while developing alone.
4. Start the API: `pnpm --filter @workspace/api-server run dev`
   (defaults to port 4000, matching the Vite proxy; override with `PORT`).
5. Start the frontend: `pnpm --filter @workspace/codalla run dev`
   and open the printed URL. Sign in with a team Google account.
6. In **Settings → API keys**, add a provider key (SiliconFlow / OpenRouter /
   RunPod / custom OpenAI-compatible). AI chat won't respond without one.
7. Create a project (optionally from a GitHub URL; private repos need a PAT
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

## Deploy to Google Cloud (Cloud Run + Cloud SQL)

> Scripted version: `deploy/gcp/setup.sh` + `deploy/gcp/deploy.sh`, with CI
> builds via `cloudbuild.yaml` — see `deploy/gcp/README.md`. The manual
> commands below remain as the reference for what those scripts do.

The repo ships a single-container `Dockerfile`: Express serves the API and
the built frontend on one port (Cloud Run's `PORT`). One-time setup, from a
machine with `gcloud` logged in (replace `PROJECT`, `REGION`, passwords):

1. **Postgres**:
   ```sh
   gcloud sql instances create codalla --database-version=POSTGRES_16 \
     --tier=db-g1-small --region=REGION
   gcloud sql users set-password postgres --instance=codalla --password=DB_PASSWORD
   gcloud sql databases create codalla --instance=codalla
   ```
2. **Bucket for project files** (Cloud Run's disk is ephemeral — project
   workspaces must live on a mounted bucket to survive restarts):
   ```sh
   gcloud storage buckets create gs://PROJECT-codalla-projects --location=REGION
   ```
3. **Push the schema** (once, via the Cloud SQL proxy):
   ```sh
   cloud-sql-proxy PROJECT:REGION:codalla &   # listens on 127.0.0.1:5432
   DATABASE_URL="postgres://postgres:DB_PASSWORD@127.0.0.1:5432/codalla" \
     pnpm --filter @workspace/db run push
   ```
4. **Deploy** (from the repo root; builds with the Dockerfile):
   ```sh
   gcloud run deploy codalla --source . --region REGION --allow-unauthenticated \
     --min-instances=1 --max-instances=1 \
     --add-cloudsql-instances PROJECT:REGION:codalla \
     --add-volume name=projects,type=cloud-storage,bucket=PROJECT-codalla-projects \
     --add-volume-mount volume=projects,mount-path=/app/codalla-projects \
     --set-env-vars "DATABASE_URL=postgres://postgres:DB_PASSWORD@/codalla?host=/cloudsql/PROJECT:REGION:codalla,APP_URL=https://YOUR-RUN-URL,GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,ALLOWED_EMAIL_DOMAINS=yourcompany.com"
   ```
   First deploy prints the service URL — set `APP_URL` to it and add
   `https://YOUR-RUN-URL/api/auth/google/callback` to the OAuth client's
   authorized redirect URIs, then redeploy (or `gcloud run services update
   codalla --update-env-vars APP_URL=...`).

Notes:
- `--max-instances=1` is required: project files are instance-local state.
  The GCS volume keeps them across restarts; scaling beyond one instance
  needs a shared-filesystem story first (Filestore or per-project GCS).
- For shared datasets ("Server folder" projects), mount a second bucket and
  set `CODALLA_DATA_ROOTS` to its mount path.
- Secrets are cleaner in Secret Manager: `--set-secrets` instead of
  `--set-env-vars` for `GOOGLE_CLIENT_SECRET` and `DATABASE_URL`.

## Business workflows (data prep and beyond)

Codalla is not hardcoded to one use case. Two building blocks cover the
"team preps training data" scenario and similar ones:

- **Server-folder projects**: set `CODALLA_DATA_ROOTS=/data` on the API
  server, and teammates can attach any folder under it as a project
  ("Server folder" in the New-project dialog). Files are edited in place;
  Upload Files… in the editor brings datasets in; deleting the project never
  deletes the folder. GitHub-clone projects work exactly as before.
- **Workflows**: reusable AI pipelines defined in the UI (Workflows page) —
  an ordered list of prompt steps run sequentially in a project's chat via
  "Run workflow". Starter templates ship for chat fine-tune data prep,
  image dataset prep, and vibe coding, but steps are plain prompts — teams
  define whatever pipeline they need, no code changes.
- **Team sharing**: projects and workflows have a "Share with team" toggle
  (Users icon on a project card; switch in the workflow editor). Shared
  items show a Team badge and are open to every account — teammates can
  browse/edit files and run shared workflows — while settings, the share
  toggle, and deletion stay owner-only. Chats and API keys are never
  shared. Note: on a shared hosted instance this is the sharing story;
  local/desktop installs are single-user islands bridged by git.

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

- Password auth, Clerk, Firebase, or any auth vendor — sign-in stays
  Google-only and boring.
- Stripe billing.
- Railway or any specific hosting config; deployment is "run the api-server
  next to Postgres".
