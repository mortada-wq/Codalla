#!/usr/bin/env bash
# Full deploy of Codalla to Cloud Run: builds from source (root Dockerfile,
# via Cloud Build) and sets the service's complete runtime configuration.
# Run deploy/gcp/setup.sh first. For image-only rollouts afterwards, use
# `gcloud builds submit --config cloudbuild.yaml` or the GitHub workflow.
#
# Usage:
#   PROJECT_ID=my-project ./deploy/gcp/deploy.sh
#
# Codalla has no authentication of its own — every request is attributed to
# one implicit "local" user (see artifacts/api-server/src/middleware/auth.ts).
# There is no login, no session, and no per-user access control, so this
# script keeps the deployed service IAM-only by default: only principals you
# grant the Cloud Run Invoker role can reach it. Set PUBLIC=true only if you
# genuinely want the service open to the entire internet with zero access
# control — everyone who can reach the URL gets full read/write access to
# every project, chat history, and your configured AI provider keys.
#
# On the very first deploy APP_URL is unknown — the script defaults it to a
# placeholder and prints the real service URL at the end; re-run with
# APP_URL set to that value (or use `gcloud run services update
# --update-env-vars APP_URL=...`) if anything in the app needs to know its
# own public URL.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to your GCP project id}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-codalla}"
SQL_INSTANCE="${SQL_INSTANCE:-codalla}"
BUCKET="${BUCKET:-${PROJECT_ID}-codalla-projects}"
RUN_SA="${RUN_SA:-codalla-run@${PROJECT_ID}.iam.gserviceaccount.com}"
APP_URL="${APP_URL:-https://placeholder.invalid}"
PUBLIC="${PUBLIC:-false}"

ENV_VARS="APP_URL=${APP_URL}"

ACCESS_FLAG="--no-allow-unauthenticated"
if [ "$PUBLIC" = "true" ]; then
  ACCESS_FLAG="--allow-unauthenticated"
  echo "WARNING: deploying with --allow-unauthenticated. Codalla performs no" >&2
  echo "access control of its own — this URL will be fully readable and" >&2
  echo "writable by anyone who finds it." >&2
fi

# --max-instances=1 is required: project workspaces are instance-local state
# on the mounted GCS volume; scaling out needs a shared-filesystem story
# first (see PLAN.md). GCS volume mounts require the gen2 execution
# environment.
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --source . \
  --region "$REGION" \
  "$ACCESS_FLAG" \
  --service-account "$RUN_SA" \
  --execution-environment gen2 \
  --min-instances=1 --max-instances=1 \
  --memory=1Gi --cpu=1 \
  --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${SQL_INSTANCE}" \
  --add-volume "name=projects,type=cloud-storage,bucket=${BUCKET}" \
  --add-volume-mount "volume=projects,mount-path=/app/codalla-projects" \
  --set-env-vars "$ENV_VARS" \
  --set-secrets "DATABASE_URL=codalla-database-url:latest"

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
echo
echo "Deployed: $URL   (health: ${URL}/api/healthz)"
if [ "$PUBLIC" != "true" ]; then
  echo
  echo "Service is IAM-only. Grant access with:"
  echo "  gcloud run services add-iam-policy-binding $SERVICE --project $PROJECT_ID --region $REGION \\"
  echo "    --member='user:you@example.com' --role='roles/run.invoker'"
fi
if [ "$APP_URL" != "$URL" ]; then
  echo
  echo "APP_URL is '$APP_URL' but the service URL is '$URL'. If needed:"
  echo "  gcloud run services update $SERVICE --project $PROJECT_ID --region $REGION \\"
  echo "    --update-env-vars APP_URL=${URL}"
fi
