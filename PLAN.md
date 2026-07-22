# Plan: make Codalla work

Codalla has **no authentication**. Every request is attributed to one
implicit `local` user row (see `artifacts/api-server/src/middleware/auth.ts`)
— there is no login, no session, no per-user access control, and no
`AUTH_DISABLED` flag (that idea was tried and removed; this file used to
describe a Google-OAuth-only design that was never actually built — don't
reintroduce it casually, see Non-goals). Billing and hosted-deploy config
remain out of scope.

Because there's no real identity, the `isShared`/"Team sharing" toggles
described below are a **visibility filter between trusting collaborators**,
not an access-control boundary — anyone who can reach a deployed instance
already has full access to everything on it. Don't deploy an instance beyond
a trusted network without adding a real access layer in front of it (Cloud
Run IAM, an authenticating reverse proxy, a VPN) — see `deploy/gcp/README.md`
and `deploy/railway/README.md`.

## Current state

- **Removed**: password/JWT auth, Google OAuth, Emergent OAuth, Stripe plans,
  phone/OTP verification, device-fingerprint anti-fraud tracking, test
  credentials, and unrelated repo content. `sessionsTable`, `userPhonesTable`,
  `deviceFingerprintsTable`, `signupAuditTable`, and `usersTable.googleId`
  are gone from the schema — they were dead weight from these removed
  features.
- **Auth now**: none. `requireAuth` middleware attaches the single implicit
  local user to every request.
- **Working**: full workspace `pnpm run typecheck` and `pnpm run build` pass;
  chat vibe-coding loop verified end-to-end in a real browser (streamed
  replies, file blocks, usage accounting).
- **Fixed (this pass)**: re-clone no longer deletes the working directory
  before the new clone succeeds; several sub-resource routes (memory notes,
  success criteria, conversation messages, workflow-executions, jobs) now
  check project/resource ownership instead of trusting the ID alone; the
  in-memory SQLite dev fallback (which didn't actually work — it referenced
  a private drizzle API that doesn't exist at runtime and silently created
  zero tables) was removed in favor of failing fast with a clear error when
  `DATABASE_URL` is unset; `conversationsTable.projectId` now has a proper
  foreign key (`set null` on project delete, since a conversation can exist
  without a project).

## Phase 1 — run it

1. Start a PostgreSQL 15+ instance and set `DATABASE_URL`, e.g.
   `postgres://postgres:postgres@localhost:5432/codalla`. Required — there
   is no fallback; the server refuses to start without it.
2. Push the schema: `pnpm --filter @workspace/db run push`.
3. Start the API: `pnpm --filter @workspace/api-server run dev`
   (defaults to port 4000, matching the Vite proxy; override with `PORT`).
4. Start the frontend: `pnpm --filter @workspace/codalla run dev`
   and open the printed URL.
5. In **Settings → API keys**, add a provider key (SiliconFlow / OpenRouter /
   RunPod / custom OpenAI-compatible). AI chat won't respond without one.
6. Create a project (optionally from a GitHub URL; private repos need a PAT
   in Settings → General → GitHub token) and open it in the editor.

## Phase 2 — make it robust

1. ~~Single-process serving~~ — **done**: Express already serves the built
   frontend (`artifacts/codalla/dist/public`) with an SPA fallback.
2. **Smoke tests**: a script that boots the server against a scratch DB and
   exercises health, project CRUD, and settings round-trip. Wire it into a
   minimal GitHub Actions workflow (install → typecheck → build → smoke).
   There are currently zero automated tests anywhere in the repo, and the
   only CI workflow is a manual-dispatch Cloud Run deploy with no build/test
   gate.
3. **Frontend bundle**: code-split Monaco and Recharts (the 1.1 MB chunk) via
   dynamic import / `manualChunks`. Still outstanding.
4. **Error surfaces**: replace Express's default HTML error page with a JSON
   error handler; surface DB-connection failures as a friendly banner in the
   UI instead of failed queries; make `GET /api/healthz` actually check DB
   connectivity instead of unconditionally returning ok.

## Deploy to Google Cloud (Cloud Run + Cloud SQL)

> Scripted version: `deploy/gcp/setup.sh` + `deploy/gcp/deploy.sh`, with CI
> builds via `cloudbuild.yaml` — see `deploy/gcp/README.md` for the full
> walkthrough, including the IAM-only-by-default access model.

The repo ships a single-container `Dockerfile`: Express serves the API and
the built frontend on one port (Cloud Run's `PORT`). Since Codalla has no
authentication of its own, `deploy/gcp/deploy.sh` deploys **IAM-only by
default** (only principals granted the Cloud Run Invoker role can reach the
service) — pass `PUBLIC=true` only if you deliberately want it open to the
entire internet with zero access control.

Notes:
- `--max-instances=1` is required: project files are instance-local state.
  The GCS volume keeps them across restarts; scaling beyond one instance
  needs a shared-filesystem story first (Filestore or per-project GCS).
- For shared datasets ("Server folder" projects), mount a second bucket and
  set `CODALLA_DATA_ROOTS` to its mount path.
- `DATABASE_URL` is cleanest in Secret Manager (`--set-secrets`), which is
  what `deploy.sh` already does.

## Deploy to Railway

> See `deploy/railway/README.md` for the full walkthrough, including why
> generating a public Railway domain means the instance is open to anyone
> who has the URL (Railway has no Cloud-Run-style IAM gate).

The same single-container `Dockerfile` builds for Railway — `railway.json`
at the repo root pins the builder to it so Railway doesn't try to deploy
internal workspace packages (`lib/*`, `artifacts/*`) as separate services.
One project = one app service (built from the Dockerfile) + Railway's
Postgres plugin + a Volume mounted at `/app/codalla-projects` for project
files (Railway's disk is otherwise ephemeral across redeploys, same
constraint as Cloud Run's). As with Cloud Run, keep it to a single
replica — project files are instance-local state.

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
  define whatever pipeline they need, no code changes. Note: there is also a
  separate, DB-backed, checkpointed workflow-execution engine
  (`workflow_execution`/`workflow_step_execution` tables, `/workflow-executions`
  routes) that the UI does not currently call — "Run workflow" uses a
  simpler client-side loop instead. Worth reconciling: either switch the UI
  to the persisted engine (gets resumability for free) or remove the unused
  one.
- **Team sharing**: projects and workflows have a "Share with team" toggle
  (Users icon on a project card; switch in the workflow editor). Shared
  items show a Team badge and are open to every account — teammates can
  browse/edit files and run shared workflows — while settings, the share
  toggle, and deletion stay owner-only *in code*. Since there's no real
  per-user identity (see top of this file), that owner-only boundary only
  has teeth if every user of a shared instance is already fully trusted.
  Chats and API keys are never shared. Note: on a shared hosted instance
  this is the sharing story; local/desktop installs are single-user islands
  bridged by git.

## Phase 3 — product completeness (from the PRD, minus auth/billing)

1. Editor polish: file tree refresh after git operations, unsaved-change
   guards, diff view for AI-proposed edits. None of this exists yet — closing
   a dirty tab or navigating away currently discards changes with no warning.
2. AI actions: apply-patch flow end-to-end (proposal → review → write to
   disk → git commit). Currently Apply only updates in-memory editor state
   with no diff/confirm/undo; the user must still manually save, and nothing
   commits.
3. Memory/criteria panels: verify round-trips against the API and prune dead
   endpoints from `openapi.yaml` (it's missing roughly 18 real routes —
   ai-actions, patterns, workflow-execution, jobs — not just the two
   previously-known gaps), then re-run
   `pnpm --filter @workspace/api-spec run codegen`.
4. Usage tracking: streaming chat doesn't request `stream_options.include_usage`,
   so token/cost accounting is silently zeroed for most chat turns — this
   needs a real fix, not just verification.

## Non-goals (removed on purpose — do not reintroduce casually)

- Any authentication — password, Clerk, Firebase, Google OAuth, or any other
  vendor. Multiple prior passes have added and then fully removed auth; the
  product is a single-implicit-user tool. If real multi-user access control
  is ever needed, treat it as a deliberate, from-scratch design decision, not
  something to bolt back on piecemeal.
- Stripe billing.
- Multi-instance scaling; project files are instance-local state (see the
  Cloud Run and Railway deploy sections), so both documented paths pin a
  single replica/instance on purpose.
