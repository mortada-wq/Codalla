#!/usr/bin/env bash
# One-time GCP provisioning for Codalla (Cloud Run + Cloud SQL + GCS).
# Idempotent: safe to re-run; existing resources are left alone.
#
# Usage:
#   PROJECT_ID=my-project REGION=europe-west1 ./deploy/gcp/setup.sh
#
# Requires: gcloud (logged in), openssl. After this, push the DB schema and
# run ./deploy/gcp/deploy.sh — full walkthrough in deploy/gcp/README.md.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to your GCP project id}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-codalla}"
REPOSITORY="${REPOSITORY:-codalla}"
SQL_INSTANCE="${SQL_INSTANCE:-codalla}"
SQL_TIER="${SQL_TIER:-db-g1-small}"
DB_NAME="${DB_NAME:-codalla}"
BUCKET="${BUCKET:-${PROJECT_ID}-codalla-projects}"
RUN_SA_NAME="${RUN_SA_NAME:-codalla-run}"
RUN_SA="${RUN_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "── Enabling APIs ──────────────────────────────────────────────────"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com

echo "── Artifact Registry repo: $REPOSITORY ────────────────────────────"
gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format=docker --location="$REGION" \
    --description="Codalla container images"

echo "── Cloud SQL Postgres: $SQL_INSTANCE ──────────────────────────────"
if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=')"
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 --tier="$SQL_TIER" --region="$REGION"
  gcloud sql users set-password postgres --instance="$SQL_INSTANCE" --password="$DB_PASSWORD"
  echo "Generated a postgres password and stored it in the codalla-database-url secret below."
  echo "(not printed here — it can end up in terminal scrollback or CI logs; retrieve it with"
  echo " 'gcloud secrets versions access latest --secret=codalla-database-url' if you need it directly)"
else
  echo "Instance exists; skipping. Set DB_PASSWORD env var to (re)create the DATABASE_URL secret."
  DB_PASSWORD="${DB_PASSWORD:-}"
fi
gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1 ||
  gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"

echo "── GCS bucket for project workspaces: gs://$BUCKET ────────────────"
# Cloud Run's disk is ephemeral; project files live on this mounted bucket.
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 ||
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
    --uniform-bucket-level-access

echo "── Runtime service account: $RUN_SA ───────────────────────────────"
gcloud iam service-accounts describe "$RUN_SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$RUN_SA_NAME" \
    --display-name="Codalla Cloud Run runtime"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUN_SA" --role=roles/cloudsql.client --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$RUN_SA" --role=roles/storage.objectAdmin >/dev/null

echo "── Secrets ────────────────────────────────────────────────────────"
if [ -n "$DB_PASSWORD" ]; then
  DATABASE_URL="postgres://postgres:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
  if gcloud secrets describe codalla-database-url >/dev/null 2>&1; then
    printf '%s' "$DATABASE_URL" | gcloud secrets versions add codalla-database-url --data-file=-
  else
    printf '%s' "$DATABASE_URL" | gcloud secrets create codalla-database-url --data-file=-
  fi
else
  echo "DB_PASSWORD unset — leaving codalla-database-url secret as-is."
fi
gcloud secrets describe codalla-database-url >/dev/null 2>&1 &&
  gcloud secrets add-iam-policy-binding codalla-database-url \
    --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor >/dev/null

echo
echo "Done. Next steps (deploy/gcp/README.md):"
echo "  1. Push the DB schema through the Cloud SQL proxy."
echo "  2. PROJECT_ID=$PROJECT_ID REGION=$REGION ./deploy/gcp/deploy.sh"
echo "     (add PUBLIC=true only if you want the service open with no access control —"
echo "     Codalla itself has no authentication, see PLAN.md)"
