#!/usr/bin/env bash
# Create self-signed cert.pem + key.pem in docker/traefik/ssl/ when missing (Traefik default TLS store).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${ROOT}/docker/traefik/ssl"
mkdir -p "$DIR"
if [[ -f "${DIR}/cert.pem" && -f "${DIR}/key.pem" ]]; then
  exit 0
fi
command -v openssl >/dev/null 2>&1 || {
  echo "ensure-traefik-ssl.sh: openssl not found; install openssl or place cert.pem + key.pem in ${DIR}" >&2
  exit 1
}
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "${DIR}/key.pem" \
  -out "${DIR}/cert.pem" \
  -subj "/CN=edgecontrol-traefik-local"
chmod 600 "${DIR}/key.pem" 2>/dev/null || true
echo "Created self-signed ${DIR}/cert.pem + key.pem (replace with real certs for production)."
