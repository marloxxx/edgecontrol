#!/usr/bin/env bash
# Render docker/traefik/dynamic.d/00-static.yml from .env (BASE_DOMAIN, optional MINIO_*_HOST). Panel is not in static — use managed routes or published web port.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
TEMPLATE="${ROOT}/docker/traefik/dynamic.d/00-static.yml.template"
OUT="${ROOT}/docker/traefik/dynamic.d/00-static.yml"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing template: $TEMPLATE" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${BASE_DOMAIN:=example.com}"
MINIO_CONSOLE_HOST="${MINIO_CONSOLE_HOST:-minio.${BASE_DOMAIN}}"
MINIO_API_HOST="${MINIO_API_HOST:-s3.${BASE_DOMAIN}}"

tmp="$(mktemp)"
sed \
  -e "s|__MINIO_API_HOST__|${MINIO_API_HOST}|g" \
  -e "s|__MINIO_CONSOLE_HOST__|${MINIO_CONSOLE_HOST}|g" \
  "$TEMPLATE" >"$tmp"
mv "$tmp" "$OUT"
echo "Wrote ${OUT} (s3=${MINIO_API_HOST}, minio=${MINIO_CONSOLE_HOST})"
