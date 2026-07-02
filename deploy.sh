#!/usr/bin/env bash
# Manual deploy script — run from the repo root.
# Requires: docker, gcloud (authenticated), firebase-tools, node >= 18
set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID}"
REGION="${CLOUD_RUN_REGION:-asia-southeast1}"
SERVICE="mornut-backend"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE"

echo "=== [1/4] Build backend Docker image ==="
docker build -t "$IMAGE" backend/

echo "=== [2/4] Push to Container Registry ==="
docker push "$IMAGE"

echo "=== [3/4] Deploy to Cloud Run ==="
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --port 8080

echo "=== [4/4] Build frontend + deploy Firebase ==="
(cd frontend && npm ci && npm run build)
firebase deploy --only hosting,firestore

BACKEND_URL=$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --format "value(status.url)")

echo ""
echo "Deploy complete!"
echo "  Backend : $BACKEND_URL"
echo "  Frontend: https://$PROJECT_ID.web.app"
echo ""
echo "Set these env vars on Cloud Run before going live:"
echo "  LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_NOTIFY_TOKEN"
echo "  SLIPOK_API_KEY, SLIPOK_ENDPOINT"
echo "  FIREBASE_STORAGE_BUCKET, CLINIC_ID, LIFF_URL, SCHEDULER_SECRET"
