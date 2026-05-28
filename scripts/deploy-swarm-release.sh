#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${1:-carreirausa}"
SERVICE="${2:-carreirahub_hub}"
REMOTE_RELEASE_ROOT="${REMOTE_RELEASE_ROOT:-/opt/carreirahub/releases}"

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to deploy with a dirty worktree."
  echo "Commit or stash your changes first so production matches a real git revision."
  exit 1
fi

FULL_SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short=12 HEAD)"
REMOTE_RELEASE_DIR="${REMOTE_RELEASE_ROOT}/${FULL_SHA}"
IMAGE_TAG="carreirahub-local:${SHORT_SHA}"

echo "Deploying ${FULL_SHA} to ${HOST}"
echo "Release dir: ${REMOTE_RELEASE_DIR}"
echo "Image tag: ${IMAGE_TAG}"

git archive --format=tar HEAD | ssh "$HOST" "
  set -euo pipefail
  mkdir -p '${REMOTE_RELEASE_DIR}'
  tar -xf - -C '${REMOTE_RELEASE_DIR}'
"

ssh "$HOST" "
  set -euo pipefail
  docker build -t '${IMAGE_TAG}' '${REMOTE_RELEASE_DIR}'
  docker service update --force --image '${IMAGE_TAG}' '${SERVICE}'
"

cat <<EOF
Deploy submitted.
Host: ${HOST}
Service: ${SERVICE}
Image: ${IMAGE_TAG}
Commit: ${FULL_SHA}

Recommended verification:
  ssh ${HOST} 'docker service ps ${SERVICE} --no-trunc'
  ssh ${HOST} 'docker service inspect ${SERVICE} --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"'
  curl -fsS https://app.carreirausa.com/api/health
EOF
