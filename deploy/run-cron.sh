#!/usr/bin/env bash
# CarreiraHub cron runner
# Usage: /opt/carreirahub/run-cron.sh <route-name>
# Example: /opt/carreirahub/run-cron.sh process-queue
#
# Install: cp deploy/run-cron.sh /opt/carreirahub/run-cron.sh && chmod +x /opt/carreirahub/run-cron.sh

set -euo pipefail

ROUTE="${1:?Usage: run-cron.sh <route-name>}"
ENV_FILE="${ENV_FILE:-/opt/carreirahub/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[cron] ERROR: env file not found: $ENV_FILE" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

APP_URL="${NEXT_PUBLIC_APP_URL:-https://app.carreirausa.com}"
SECRET="${CRON_SECRET:?CRON_SECRET not set in $ENV_FILE}"

ENDPOINT="${APP_URL}/api/cron/${ROUTE}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 \
  -H "Authorization: Bearer ${SECRET}" \
  "$ENDPOINT")

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "[cron] OK ${ROUTE} → ${HTTP_CODE}"
else
  echo "[cron] FAIL ${ROUTE} → ${HTTP_CODE}" >&2
  exit 1
fi
