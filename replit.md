# Codalla

Team AI coding IDE: create projects (optionally cloned from GitHub), browse/edit files with Monaco, and chat with AI models about the code. Sign-in is Google-only (no passwords, no auth vendor); each user's projects, keys, and usage are scoped to their account.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 4000, matches the Vite proxy)
- `pnpm --filter @workspace/codalla run dev` — run the frontend (Vite dev server)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Auth env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` (browser origin; the Google OAuth client must allow `${APP_URL}/api/auth/google/callback` as a redirect URI), `ALLOWED_EMAIL_DOMAINS` and/or `ALLOWED_EMAILS` (comma-separated team gate) — or `AUTH_DISABLED=true` to skip sign-in entirely for solo dev

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API server: `artifacts/api-server` (routes in `src/routes`, one file per resource)
- Frontend: `artifacts/codalla` (React 19 + Vite, wouter routing, shadcn/ui components)
- DB schema (source of truth): `lib/db/src/schema/index.ts`
- API contract (source of truth): `lib/api-spec/openapi.yaml` → codegen into `lib/api-zod` and `lib/api-client-react`
- Plan / roadmap: `PLAN.md`

## Architecture decisions

- **Google-only sign-in, no auth vendor.** Standard OAuth code flow via `google-auth-library` (`artifacts/api-server/src/routes/auth.ts`); sessions are DB rows (`sessions` table, SHA-256 of a random cookie token) so revoking = deleting a row. Team access is gated by `ALLOWED_EMAIL_DOMAINS`/`ALLOWED_EMAILS`. `AUTH_DISABLED=true` falls back to a single implicit `local` user for solo dev.
- Frontend talks to the API same-origin via the Vite `/api` proxy → `localhost:4000`.
- Git operations use `spawnSync` (never `execSync`); filesystem access goes through a separator-boundary `safePath` check.

## Product

Dashboard (projects), Editor (Monaco + AI chat per project), Models (built-in + custom providers), Settings (general / API keys / usage).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
