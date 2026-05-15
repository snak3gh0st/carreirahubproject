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

read_env_var() {
  local key="$1"
  local value
  value="$(grep -m1 "^${key}=" "$ENV_FILE" | cut -d= -f2- || true)"
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

APP_URL="$(read_env_var NEXT_PUBLIC_APP_URL)"
APP_URL="${APP_URL:-https://app.carreirausa.com}"
SECRET="$(read_env_var CRON_SECRET)"

if [[ -z "$SECRET" ]]; then
  echo "[cron] ERROR: CRON_SECRET not set in $ENV_FILE" >&2
  exit 1
fi

ENDPOINT="${APP_URL}/api/cron/${ROUTE}"
CURL_MAX_TIME="${CRON_CURL_MAX_TIME:-60}"

case "$ROUTE" in
  clint-sync)
    CURL_MAX_TIME="${CRON_CURL_MAX_TIME:-900}"
    ;;
  quickbooks-sync|process-queue)
    CURL_MAX_TIME="${CRON_CURL_MAX_TIME:-300}"
    ;;
esac

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time "$CURL_MAX_TIME" \
  -H "Authorization: Bearer ${SECRET}" \
  "$ENDPOINT")

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "[cron] OK ${ROUTE} → ${HTTP_CODE}"
else
  echo "[cron] FAIL ${ROUTE} → ${HTTP_CODE}" >&2
  exit 1
fi
