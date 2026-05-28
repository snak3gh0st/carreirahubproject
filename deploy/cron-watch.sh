#!/usr/bin/env bash
# Watches the cron log and sends a Telegram alert when new failures appear.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/carreirahub/.env}"
LOG_FILE="${LOG_FILE:-/var/log/carreirahub-cron.log}"
LINES_FILE="${LINES_FILE:-/tmp/cron-watch-lines}"
STATE_FILE="${STATE_FILE:-/tmp/cron-watch-last-alert}"
MAX_FAILURE_LINES="${MAX_FAILURE_LINES:-12}"
MAX_PREVIEW_CHARS="${MAX_PREVIEW_CHARS:-1800}"

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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[cron-watch] env file not found: $ENV_FILE"
  exit 0
fi

BOT_TOKEN="$(read_env_var TELEGRAM_BOT_TOKEN)"
CHAT_ID="$(read_env_var TELEGRAM_CHAT_ID)"

if [[ -z "$BOT_TOKEN" ]]; then
  echo "[cron-watch] TELEGRAM_BOT_TOKEN not configured"
  exit 0
fi

if [[ -z "$CHAT_ID" ]]; then
  echo "[cron-watch] TELEGRAM_CHAT_ID not configured"
  exit 0
fi

if [[ ! -f "$LOG_FILE" ]]; then
  echo "[cron-watch] log not found: $LOG_FILE"
  exit 0
fi

LAST=0
if [[ -f "$LINES_FILE" ]]; then
  LAST="$(cat "$LINES_FILE" 2>/dev/null || echo 0)"
  [[ "$LAST" =~ ^[0-9]+$ ]] || LAST=0
fi

CURRENT="$(wc -l < "$LOG_FILE" | tr -d '[:space:]')"
echo "$CURRENT" > "$LINES_FILE"

if [[ "$CURRENT" -le "$LAST" ]]; then
  exit 0
fi

NEW_LINES="$(tail -n +"$((LAST + 1))" "$LOG_FILE")"
FAILURES="$(printf '%s\n' "$NEW_LINES" | grep -Ei 'failed|fail|error|exit-code|unauthorized|timeout|NOAUTH' || true)"

if [[ -z "$FAILURES" ]]; then
  exit 0
fi

PREVIEW_RAW="$(printf '%s\n' "$FAILURES" | tail -n "$MAX_FAILURE_LINES")"
FAILURE_COUNT="$(printf '%s\n' "$FAILURES" | sed '/^$/d' | wc -l | tr -d '[:space:]')"
SIGNATURE="$(printf '%s' "$PREVIEW_RAW" | shasum -a 256 | cut -d' ' -f1)"

if [[ -f "$STATE_FILE" ]] && [[ "$(cat "$STATE_FILE" 2>/dev/null || true)" == "$SIGNATURE" ]]; then
  echo "[cron-watch] duplicate alert skipped"
  exit 0
fi

PREVIEW="$(
  printf '%s\n' "$PREVIEW_RAW" |
    sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
)"
PREVIEW="${PREVIEW:0:$MAX_PREVIEW_CHARS}"

TMP_MSG_FILE="$(mktemp)"
trap 'rm -f "$TMP_MSG_FILE"' EXIT

{
  printf 'CRON FAILURE - carreirausa\n\n'
  printf 'Detected %s matching failure lines since last scan.\n\n' "$FAILURE_COUNT"
  printf '<pre>%s</pre>\n\n' "$PREVIEW"
  date -Iseconds
} > "$TMP_MSG_FILE"

curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text@${TMP_MSG_FILE}" \
  -d "parse_mode=HTML" \
  -d "disable_web_page_preview=true" >/dev/null

printf '%s' "$SIGNATURE" > "$STATE_FILE"
echo "[cron-watch] alert sent"
