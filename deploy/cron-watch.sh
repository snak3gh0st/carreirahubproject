#!/usr/bin/env bash
# Watches the cron log and sends a Telegram alert when new failures appear.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/carreirahub/.env}"
LOG_FILE="${LOG_FILE:-/var/log/carreirahub-cron.log}"
LINES_FILE="${LINES_FILE:-/tmp/cron-watch-lines}"

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

PREVIEW="$(
  printf '%s\n' "$FAILURES" |
    tail -20 |
    sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
)"

MSG="$(printf 'CRON FAILURE - carreirausa\n\n<pre>%s</pre>\n\n%s' "$PREVIEW" "$(date -Iseconds)")"

curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${MSG}" \
  -d "parse_mode=HTML" \
  -d "disable_web_page_preview=true" >/dev/null

echo "[cron-watch] alert sent"
