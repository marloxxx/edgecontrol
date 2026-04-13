#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

echo "Creating database backup..."
pg_dump "${DATABASE_URL}" > "${BACKUP_DIR}/db-${TIMESTAMP}.sql"

echo "Copying Traefik dynamic config..."
cp ./docker/traefik/dynamic.yml "${BACKUP_DIR}/dynamic-${TIMESTAMP}.yml"

echo "Backup completed in ${BACKUP_DIR}"
