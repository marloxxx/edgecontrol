#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"
BACKUP_ABS="$(cd "${BACKUP_DIR}" && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

# Matches Docker Compose volume name: ${COMPOSE_PROJECT_NAME}_minio_data (default project name: directory name).
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)")}"
MINIO_VOLUME="${MINIO_BACKUP_VOLUME_NAME:-${COMPOSE_PROJECT_NAME}_minio_data}"

echo "Creating database backup..."
pg_dump "${DATABASE_URL}" > "${BACKUP_ABS}/db-${TIMESTAMP}.sql"

echo "Copying Traefik dynamic config..."
cp ./docker/traefik/dynamic.yml "${BACKUP_ABS}/dynamic-${TIMESTAMP}.yml"

if docker volume inspect "${MINIO_VOLUME}" &>/dev/null; then
  echo "Archiving MinIO data volume (${MINIO_VOLUME})..."
  docker run --rm \
    -v "${MINIO_VOLUME}:/data:ro" \
    -v "${BACKUP_ABS}:/backup" \
    alpine:3.20 \
    tar czf "/backup/minio-${TIMESTAMP}.tar.gz" -C /data .
else
  echo "Skipping MinIO archive (volume ${MINIO_VOLUME} not found)."
fi

echo "Backup completed in ${BACKUP_ABS}"
