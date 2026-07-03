#!/usr/bin/env bash
# Manual deploy script — run from the repo root.
# Requires: docker, gcloud (authenticated), node >= 18
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${CLOUD_RUN_REGION:-asia-southeast1}"
SERVICE="mornut-backend"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE"

echo "=== [1/3] Build backend Docker image ==="
docker build -t "$IMAGE" backend/

echo "=== [2/3] Push to Container Registry ==="
docker push "$IMAGE"

echo "=== [3/3] Deploy to Cloud Run ==="
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --port 8080

BACKEND_URL=$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --format "value(status.url)")

echo ""
echo "Backend deployed: $BACKEND_URL"
echo ""
echo "Required Cloud Run env vars (set via gcloud or Cloud Console):"
echo "  DATABASE_URL, JWT_SECRET, CLINIC_ID, LIFF_URL"
echo "  LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_NOTIFY_TOKEN"
echo "  SLIPOK_API_KEY, SLIPOK_ENDPOINT, SCHEDULER_SECRET"
echo "  ALLOWED_ORIGINS=https://<your-frontend-domain>"
echo ""
echo "Frontend: build and deploy to Vercel / Netlify / any static host:"
echo "  cd frontend && npm ci && npm run build"
echo "  # then upload dist/ to your hosting provider"
