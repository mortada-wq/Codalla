# Codalla

Team AI coding IDE: create projects (optionally cloned from GitHub), browse/edit files with Monaco, and chat with AI models about the code. Codalla has no authentication — every request is attributed to one implicit "local" user; there is no login, session, or per-user access control.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 4000, matches the Vite proxy)
- `pnpm --filter @workspace/codalla run dev` — run the frontend (Vite dev server)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (no fallback; the server refuses to start without it)
- `CODALLA_DATA_ROOTS` — comma-separated absolute paths that may be attached as projects ("Server folder" mode); unset disables attaching

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

- **No authentication.** `requireAuth` middleware (`artifacts/api-server/src/middleware/auth.ts`) attaches one implicit `local` user row to every request. See `PLAN.md` for why, and for what a deployed instance needs in front of it instead (Cloud Run IAM, an authenticating proxy, a VPN) since Codalla itself enforces no access control.
- Frontend talks to the API same-origin via the Vite `/api` proxy → `localhost:4000`.
- Git operations use `spawnSync` (never `execSync`); filesystem access goes through a separator-boundary `safePath` check.

## Product

Dashboard (projects: blank / GitHub clone / AI-generated / attached server folder), Editor (Monaco + AI chat per project, file upload, run workflows), Workflows (reusable AI pipeline presets — ordered prompt steps, modality-agnostic), Models (built-in + custom providers), Settings (general / API keys / usage). Projects and workflows can be shared with the whole team (isShared; owner keeps edit/delete/share control; chats and keys stay private).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
