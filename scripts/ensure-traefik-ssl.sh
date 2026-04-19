#!/usr/bin/env bash
# Create self-signed cert.pem + key.pem in docker/traefik/ssl/ when missing (Traefik default TLS store).
# Traefik only reads cert.pem + key.pem — leaving the bootstrap self-signed in place while STAR_*.crt sits
# alongside it still yields NET::ERR_CERT_AUTHORITY_INVALID in browsers until you replace cert.pem/key.pem.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${ROOT}/docker/traefik/ssl"
mkdir -p "$DIR"
if [[ -f "${DIR}/cert.pem" && -f "${DIR}/key.pem" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    subj="$(openssl x509 -in "${DIR}/cert.pem" -noout -subject 2>/dev/null || true)"
    if [[ "$subj" == *"edgecontrol-traefik-local"* ]]; then
      echo "ensure-traefik-ssl.sh: WARNING: ${DIR}/cert.pem is still the bootstrap self-signed cert (CN=edgecontrol-traefik-local)." >&2
      echo "  Browsers will show NET::ERR_CERT_AUTHORITY_INVALID until you replace cert.pem (full chain) and key.pem (private key)." >&2
      shopt -s nullglob
      star=( "${DIR}"/STAR*.crt "${DIR}"/*.crt )
      shopt -u nullglob
      if ((${#star[@]})); then
        echo "  Found other .crt files (e.g. STAR_*.crt) — Traefik does not load those names automatically; merge into cert.pem:" >&2
        echo "    cat STAR_ptsi_co_id.crt STAR_ptsi_co_id.ca-bundle > docker/traefik/ssl/cert.pem" >&2
        echo "    cp <matching-private-key> docker/traefik/ssl/key.pem && chmod 600 docker/traefik/ssl/key.pem" >&2
      fi
    fi
  fi
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
