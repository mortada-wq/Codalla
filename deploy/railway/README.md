# Hosting Codalla on Railway

Codalla ships as a single container (root `Dockerfile`): Express serves the
API and the built frontend on one port. On Railway that maps to exactly two
services in one project — no need to deploy `lib/*` or `artifacts/*`
workspace packages separately:

| Piece | Railway resource |
| --- | --- |
| App (API + frontend) | 1 service, built from the root `Dockerfile` (`railway.json` at repo root pins this) |
| Database | Railway's built-in PostgreSQL plugin |
| Project workspaces (files) | a Railway Volume mounted at `/app/codalla-projects` |

**Codalla has no authentication of its own** — every request is attributed
to one implicit local user (see `PLAN.md`). Unlike Cloud Run, Railway has no
built-in IAM gate in front of a public domain: the moment you generate one
(step 3), anyone with the URL has full read/write access to every project,
chat history, and your configured AI provider keys. Only generate a public
domain if that's genuinely acceptable, or put an authenticating reverse
proxy in front of it.

## 1. Create the project

In the Railway dashboard: **New Project → Deploy from GitHub repo** and pick
this repo. Railway detects `railway.json` and builds with the root
`Dockerfile` automatically — delete/ignore any other service cards Railway
may have auto-created from subfolders (`api-spec`, `api-zod`, `api-client`,
`mockup-sandbox`, etc.); those are internal workspace packages, not
deployable apps, and building them standalone is why they show
"Build failed."

You should end up with exactly **one** app service (call it `codalla`) plus
the database below.

## 2. Add PostgreSQL

**New → Database → Add PostgreSQL** in the same project. Railway provisions
it and exposes a `DATABASE_URL` reference variable you can wire into the app
service (step 3) without copy-pasting the value.

## 3. Configure the app service's Variables

On the `codalla` service → Variables, add:

- `DATABASE_URL` → reference `${{Postgres.DATABASE_URL}}` (pick the Postgres
  service from the reference picker — do not hardcode it)
- `APP_URL` → the service's public domain, e.g.
  `https://codalla-production.up.railway.app` (Railway assigns this once you
  enable networking under Settings → Networking → Generate Domain; fill this
  in after the first deploy, then redeploy)
- Optional: `OPENROUTER_API_KEY`, `SILICONFLOW_API_KEY`, `CODALLA_DATA_ROOTS`
  — see `.env.example`

Railway injects `PORT` itself; the app already reads it (`artifacts/api-server/src/index.ts`), no need to set it.

## 4. Add a Volume for project files

The API server stores project workspaces on local disk at
`codalla-projects` (relative to its working directory, i.e.
`/app/codalla-projects` in the container). Railway's disk is ephemeral
across redeploys, so attach a **Volume**: service → Settings → Volumes →
New Volume, mount path `/app/codalla-projects`. Without this, projects
disappear on every redeploy.

Keep the service at a single replica — like Cloud Run, project files are
instance-local state; scaling beyond one instance needs a shared-filesystem
story first.

## 5. Push the database schema

Once, from your machine, pointed at Railway's Postgres (copy the connection
string from the Postgres service → Connect tab, using the public/proxy
host):

```sh
DATABASE_URL="postgres://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway" \
  pnpm --filter @workspace/db run push
```

## 6. Deploy

Railway deploys automatically on every push to the connected branch. First
deploy: verify `https://YOUR-RAILWAY-DOMAIN/api/healthz` returns 200.

## Operational notes

- **Health**: `GET /api/healthz` — `railway.json` wires this in as the
  platform healthcheck too.
- **Logs**: service → Deployments → View Logs (JSON via pino).
- **Custom domain**: service → Settings → Networking → Custom Domain, then
  update `APP_URL` to match.
- **Env vars reference**: see `.env.example` at the repo root.
