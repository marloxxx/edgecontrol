#!/usr/bin/env bash
# Render docker/traefik/dynamic.d/00-static.yml from .env (BASE_DOMAIN, optional PANEL_HOST / MINIO_*_HOST).
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
PANEL_HOST="${PANEL_HOST:-edgecontrol.${BASE_DOMAIN}}"
MINIO_CONSOLE_HOST="${MINIO_CONSOLE_HOST:-minio.${BASE_DOMAIN}}"
MINIO_API_HOST="${MINIO_API_HOST:-s3.${BASE_DOMAIN}}"

tmp="$(mktemp)"
sed \
  -e "s|__PANEL_HOST__|${PANEL_HOST}|g" \
  -e "s|__MINIO_API_HOST__|${MINIO_API_HOST}|g" \
  -e "s|__MINIO_CONSOLE_HOST__|${MINIO_CONSOLE_HOST}|g" \
  "$TEMPLATE" >"$tmp"
mv "$tmp" "$OUT"
echo "Wrote ${OUT} (panel=${PANEL_HOST}, s3=${MINIO_API_HOST}, minio=${MINIO_CONSOLE_HOST})"
