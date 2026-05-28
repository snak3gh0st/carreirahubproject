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
    CURL_MAX_TIME="${CRON_CURL_MAX_TIME:-1800}"
    ;;
  process-queue)
    CURL_MAX_TIME="${CRON_CURL_MAX_TIME:-1500}"
    ;;
  process-quickbooks-sync)
    CURL_MAX_TIME="${CRON_CURL_MAX_TIME:-1500}"
    ;;
  quickbooks-sync|docusign-sync|evaluate-alerts)
    CURL_MAX_TIME="${CRON_CURL_MAX_TIME:-300}"
    ;;
esac

# Retry transient errors (5xx from Traefik mid-swap, 404 from Next.js
# during route registration on container boot) — handles deploy windows
# and brief upstream blips without paging Telegram.
# Budget: 5 retries × 10s delay ≈ 50s, enough to cross a healthcheck-gated
# start-first swap (40s start_period + Traefik route update).
# --retry-all-errors covers 4xx (404 during boot race) too; cron endpoints
# never legitimately return 4xx for an authenticated request.
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time "$CURL_MAX_TIME" \
  --retry 5 --retry-delay 10 --retry-all-errors \
  -H "Authorization: Bearer ${SECRET}" \
  "$ENDPOINT")

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "[cron] OK ${ROUTE} → ${HTTP_CODE}"
else
  echo "[cron] FAIL ${ROUTE} → ${HTTP_CODE}" >&2
  exit 1
fi
