#!/usr/bin/env bash
# Full deploy of Codalla to Cloud Run: builds from source (root Dockerfile,
# via Cloud Build) and sets the service's complete runtime configuration.
# Run deploy/gcp/setup.sh first. For image-only rollouts afterwards, use
# `gcloud builds submit --config cloudbuild.yaml` or the GitHub workflow.
#
# Usage:
#   PROJECT_ID=my-project GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
#     ./deploy/gcp/deploy.sh
#
# On the very first deploy APP_URL is unknown — the script defaults it to a
# placeholder, prints the real service URL at the end, and tells you how to
# update APP_URL and the OAuth redirect URI.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to your GCP project id}"
: "${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID (OAuth client id)}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-codalla}"
SQL_INSTANCE="${SQL_INSTANCE:-codalla}"
BUCKET="${BUCKET:-${PROJECT_ID}-codalla-projects}"
RUN_SA="${RUN_SA:-codalla-run@${PROJECT_ID}.iam.gserviceaccount.com}"
APP_URL="${APP_URL:-https://placeholder.invalid}"
# Optional access gating; leave unset for open signup.
ALLOWED_EMAIL_DOMAINS="${ALLOWED_EMAIL_DOMAINS:-}"

ENV_VARS="APP_URL=${APP_URL},GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
[ -n "$ALLOWED_EMAIL_DOMAINS" ] && ENV_VARS="${ENV_VARS},ALLOWED_EMAIL_DOMAINS=${ALLOWED_EMAIL_DOMAINS}"

# --max-instances=1 is required: project workspaces are instance-local state
# on the mounted GCS volume; scaling out needs a shared-filesystem story
# first (see PLAN.md). GCS volume mounts require the gen2 execution
# environment.
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --service-account "$RUN_SA" \
  --execution-environment gen2 \
  --min-instances=1 --max-instances=1 \
  --memory=1Gi --cpu=1 \
  --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${SQL_INSTANCE}" \
  --add-volume "name=projects,type=cloud-storage,bucket=${BUCKET}" \
  --add-volume-mount "volume=projects,mount-path=/app/codalla-projects" \
  --set-env-vars "$ENV_VARS" \
  --set-secrets "DATABASE_URL=codalla-database-url:latest,GOOGLE_CLIENT_SECRET=codalla-google-client-secret:latest"

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
echo
echo "Deployed: $URL   (health: ${URL}/api/healthz)"
if [ "$APP_URL" != "$URL" ]; then
  echo
  echo "APP_URL is '$APP_URL' but the service URL is '$URL'. Finish OAuth setup:"
  echo "  1. Add ${URL}/api/auth/google/callback to the OAuth client's authorized redirect URIs."
  echo "  2. gcloud run services update $SERVICE --project $PROJECT_ID --region $REGION \\"
  echo "       --update-env-vars APP_URL=${URL}"
fi
