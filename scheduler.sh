#!/usr/bin/env bash
# Run ONCE after deploying to Cloud Run to create the daily reminder job.
# The job calls POST /internal/remind/{CLINIC_ID} every day at 18:00 Bangkok time.
set -euo pipefail

BACKEND_URL="${BACKEND_URL:?Set BACKEND_URL to the Cloud Run service URL}"
CLINIC_ID="${CLINIC_ID:?Set CLINIC_ID}"
SCHEDULER_SECRET="${SCHEDULER_SECRET:?Set SCHEDULER_SECRET}"
REGION="${CLOUD_RUN_REGION:-asia-southeast1}"

gcloud scheduler jobs create http mornut-daily-reminder \
  --schedule="0 11 * * *" \
  --uri="${BACKEND_URL}/internal/remind/${CLINIC_ID}" \
  --message-body="{}" \
  --headers="Authorization=Bearer ${SCHEDULER_SECRET},Content-Type=application/json" \
  --http-method=POST \
  --location="${REGION}" \
  --time-zone="Asia/Bangkok"

echo "Created Cloud Scheduler job: mornut-daily-reminder"
echo "Fires daily at 18:00 Bangkok time (11:00 UTC)"
echo "To test immediately: gcloud scheduler jobs run mornut-daily-reminder --location=${REGION}"
