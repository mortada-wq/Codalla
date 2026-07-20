# Hosting Codalla on Google Cloud

Codalla ships as a single container (root `Dockerfile`): Express serves the
API and the built frontend on one port. The target architecture is:

| Piece | GCP service |
| --- | --- |
| App (API + frontend) | Cloud Run (1 instance, gen2) |
| Database | Cloud SQL for PostgreSQL 16 |
| Project workspaces (files) | GCS bucket mounted as a volume at `/app/codalla-projects` |
| Secrets (`DATABASE_URL`, OAuth secret) | Secret Manager |
| Images + CI builds | Artifact Registry + Cloud Build |

Region: the scripts default to `europe-west1`; `me-central1` (Doha) and
`me-central2` (Dammam) are closest to Iraq — set `REGION` accordingly.

## 1. One-time provisioning

From a machine with `gcloud` logged in:

```sh
PROJECT_ID=my-project REGION=europe-west1 ./deploy/gcp/setup.sh
```

This enables the APIs and creates: an Artifact Registry repo, the Cloud SQL
instance + `codalla` database (generating a password), the projects bucket,
a `codalla-run` runtime service account with least-privilege bindings, and
the `codalla-database-url` / `codalla-google-client-secret` secrets.

## 2. Push the database schema

Once, through the [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy):

```sh
cloud-sql-proxy PROJECT_ID:REGION:codalla &   # listens on 127.0.0.1:5432
DATABASE_URL="postgres://postgres:DB_PASSWORD@127.0.0.1:5432/codalla" \
  pnpm --filter @workspace/db run push
```

(`DB_PASSWORD` was printed by `setup.sh`. `deploy/schema.sql` is a reference
snapshot; drizzle-kit push is the source of truth.)

## 3. Google OAuth client

Sign-in is Google-only (see `PLAN.md`). In Google Cloud Console → APIs &
Services → Credentials, create an **OAuth client ID** of type "Web
application". Store its secret if `setup.sh` didn't already:

```sh
printf '%s' 'THE_CLIENT_SECRET' | gcloud secrets create codalla-google-client-secret --data-file=-
```

The redirect URI is added in step 4 once the service URL is known.

## 4. First deploy

```sh
PROJECT_ID=my-project REGION=europe-west1 \
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
ALLOWED_EMAIL_DOMAINS=yourcompany.com \
  ./deploy/gcp/deploy.sh
```

The script prints the service URL and the two follow-ups: add
`https://SERVICE_URL/api/auth/google/callback` to the OAuth client's
authorized redirect URIs, and set `APP_URL` to the service URL. Verify with
`https://SERVICE_URL/api/healthz`.

## 5. Ongoing deploys (CI/CD)

`cloudbuild.yaml` builds the image, pushes it to Artifact Registry, and rolls
out the new image while preserving the service config set in step 4. Options:

- **Manual**: `gcloud builds submit --config cloudbuild.yaml`
- **Cloud Build GitHub trigger**: connect the repo in Cloud Build → Triggers
  and point a push-to-`main` trigger at `cloudbuild.yaml`.
- **GitHub Actions**: `.github/workflows/deploy-cloudrun.yml` (manual
  dispatch by default). Configure [Workload Identity Federation](https://github.com/google-github-actions/auth#setup)
  and set repo secrets `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
  `GCP_SERVICE_ACCOUNT`.

Whichever account runs the build needs `roles/cloudbuild.builds.editor` (to
submit), and the Cloud Build service agent needs `roles/run.admin` +
`roles/iam.serviceAccountUser` on `codalla-run` to deploy.

## Operational notes

- **`--max-instances=1` is deliberate.** Project files are instance-local
  state; the GCS volume keeps them across restarts, but scaling out needs a
  shared-filesystem story first (Filestore or per-project GCS). Don't raise
  it casually.
- **Health**: `GET /api/healthz` — use it for uptime checks / monitoring.
- **Shared datasets** ("Server folder" projects): mount a second bucket and
  set `CODALLA_DATA_ROOTS` to its mount path.
- **Custom domain**: Cloud Run → Manage custom domains, then update
  `APP_URL` and the OAuth redirect URI to match.
- **Logs**: `gcloud run services logs read codalla --region REGION` (the
  server logs JSON via pino, which Cloud Logging parses natively).
- **Rough monthly cost** (small team): Cloud SQL `db-g1-small` ≈ $25–35,
  Cloud Run 1 always-on 1 CPU/1 GiB instance ≈ $40–55, storage/egress a few
  dollars. Scale tiers down for hobby use (`db-f1-micro`, `--min-instances=0`
  — accepting cold starts and slower DB).
- **Env vars reference**: see `.env.example` at the repo root.
