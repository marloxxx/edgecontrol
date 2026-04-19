#!/usr/bin/env bash
# Edgecontrol — host bootstrap (no Node) + deploy via Docker only for stack commands.
# `full` / `compose` / Docker `db|db reset|seed|reset`: Docker Engine + Compose (install attempted if missing when INSTALL_DOCKER=1).
# API image: apps/api/Dockerfile. Prisma in containers: Compose `migrate` service (builder target).
# Run from repo root: ./scripts/setup.sh   or   bash scripts/setup.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE_FILE="${ROOT}/docker-compose.yml"
ME="${0##*/}"

COPY_ENV="${COPY_ENV:-1}"
GENERATE_SECRETS="${GENERATE_SECRETS:-1}"
# When 1: no domain prompt; BASE_DOMAIN defaults from EDGE_BASE_DOMAIN or "localhost"; ACME_EMAIL tracks BASE_DOMAIN; optional CORS for Traefik panel.
AUTO_SETUP="${AUTO_SETUP:-1}"
# When 1: append any keys present in .env.example but missing from .env (does not overwrite values).
SYNC_ENV_FROM_EXAMPLE="${SYNC_ENV_FROM_EXAMPLE:-1}"
# When 1: move existing .env to .env.bak.<epoch> then recreate from .env.example (DANGER: treat like fresh install).
FORCE_ENV_SYNC="${FORCE_ENV_SYNC:-0}"
DOCKER_PREP="${DOCKER_PREP:-1}"
INSTALL_DOCKER="${INSTALL_DOCKER:-1}"
SHOW_CREDENTIALS="${SHOW_CREDENTIALS:-1}"

log() { printf '\033[0;32m[%s]\033[0m %s\n' "$(date '+%H:%M:%S')" "$*"; }
warn() { printf '\033[0;33m[%s]\033[0m %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }
die() { warn "$*"; exit 1; }

# Non-login shells (e.g. ssh non-interactive, cron) often omit /usr/bin from PATH; Docker lives there or under /snap/bin.
ensure_docker_on_path() {
  export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin${PATH:+:$PATH}"
}

ensure_traefik_static_rendered() {
  local s="$ROOT/scripts/render-traefik-static.sh"
  [[ -f "$s" ]] || return 0
  if [[ -f "$ROOT/.env" ]]; then
    bash "$s"
  else
    warn "No .env — using checked-in docker/traefik/dynamic.d/00-static.yml defaults (run ./scripts/render-traefik-static.sh after creating .env)."
  fi
  local ssl="$ROOT/scripts/ensure-traefik-ssl.sh"
  [[ -f "$ssl" ]] && bash "$ssl"
}

require_docker_cli() {
  ensure_docker_on_path
  if ! command -v docker >/dev/null 2>&1; then
    if [[ "${INSTALL_DOCKER:-1}" == "1" ]]; then
      log "Docker CLI not found; attempting install (set INSTALL_DOCKER=0 to skip)..."
      try_install_docker
      ensure_docker_on_path
    fi
    command -v docker >/dev/null 2>&1 || die "Docker CLI not found. Install Docker Engine: https://docs.docker.com/engine/install/"
  fi
  if ! docker info >/dev/null 2>&1; then
    die "Docker is installed but the daemon is not reachable (docker info failed). Linux: systemctl start docker && systemctl enable docker. macOS: open Docker Desktop and wait until it is running."
  fi
}

install_docker_darwin() {
  if ! command -v brew >/dev/null 2>&1; then
    die "Docker is not installed and Homebrew was not found. Install Homebrew (https://brew.sh) or Docker Desktop (https://docs.docker.com/desktop/install/mac-install/), then re-run this script."
  fi
  log "Installing Docker Desktop via Homebrew (may take several minutes)..."
  brew install --cask docker
  log "Docker Desktop installed. Open Docker Desktop from Applications and wait until it reports 'running', then re-run this script if docker network creation failed."
}

install_docker_linux() {
  if ! command -v curl >/dev/null 2>&1; then
    die "Docker is not installed and curl was not found. Install curl or Docker Engine (https://docs.docker.com/engine/install/), then re-run."
  fi
  local tmp
  tmp="$(mktemp)"
  log "Installing Docker Engine via get.docker.com (requires administrator privileges)..."
  curl -fsSL https://get.docker.com -o "$tmp"
  if [[ "$(id -u)" -eq 0 ]]; then
    sh "$tmp"
  elif command -v sudo >/dev/null 2>&1; then
    sudo sh "$tmp"
  else
    rm -f "$tmp"
    die "Docker install on Linux needs root or sudo. See https://docs.docker.com/engine/install/"
  fi
  rm -f "$tmp"
}

try_install_docker() {
  case "$(uname -s)" in
    Darwin)
      install_docker_darwin
      ;;
    Linux)
      install_docker_linux
      ;;
    *)
      die "Automatic Docker install is not supported on $(uname -s). Install Docker: https://docs.docker.com/get-docker/"
      ;;
  esac
}

# Append lines from .env.example for keys missing in .env (schema drift / older checkouts). Does not change existing lines.
sync_missing_keys_from_example() {
  local example="$1"
  local envf="$2"
  [[ "${SYNC_ENV_FROM_EXAMPLE:-1}" == "1" ]] || return 0
  [[ -f "$example" && -f "$envf" ]] || return 0

  local line key added=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "${line%%[![:space:]]*}" == \#* ]] && continue
    case "$line" in
      *=*) ;;
      *) continue ;;
    esac
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ -z "$key" ]] && continue
    if ! grep -q "^${key}=" "$envf" 2>/dev/null; then
      printf '%s\n' "$line" >>"$envf"
      log "Appended missing key from .env.example: ${key}"
      added=1
    fi
  done <"$example"
  [[ "$added" -eq 1 ]] || return 0
}

# Only updates keys that already exist — keeps .env aligned with .env.example (no stray appended variables).
replace_env_line() {
  local key="$1"
  local value="$2"
  local file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s@^${key}=.*@${key}=${value}@" "$file"
    else
      sed -i "s@^${key}=.*@${key}=${value}@" "$file"
    fi
  fi
}

apply_generated_secrets() {
  local f="$1"
  if ! command -v openssl >/dev/null 2>&1; then
    warn "openssl not found — cannot generate secrets. Install OpenSSL or set values in $f manually."
    return 1
  fi
  local jwt jwt_refresh dbpw minio_pw
  jwt=$(openssl rand -hex 32)
  jwt_refresh=$(openssl rand -hex 32)
  dbpw=$(openssl rand -hex 24)
  minio_pw=$(openssl rand -hex 24)
  replace_env_line JWT_SECRET "$jwt" "$f"
  if grep -q "^JWT_REFRESH_SECRET=" "$f" 2>/dev/null; then
    replace_env_line JWT_REFRESH_SECRET "$jwt_refresh" "$f"
  else
    printf '\nJWT_REFRESH_SECRET=%s\n' "$jwt_refresh" >>"$f"
  fi
  replace_env_line DB_PASSWORD "$dbpw" "$f"
  replace_env_line DATABASE_URL "postgresql://admin:${dbpw}@db:5432/edgecontrol" "$f"
  replace_env_line REDIS_URL "redis://redis:6379" "$f"
  replace_env_line GRAFANA_ADMIN_PASSWORD "$(openssl rand -hex 16)" "$f"
  replace_env_line MINIO_ROOT_PASSWORD "$minio_pw" "$f"
  patch_derived_env_keys "$f" || true
  return 0
}

# Optional host hints (export when running setup.sh):
#   EDGE_BASE_DOMAIN — if set and BASE_DOMAIN is still example.com, replace BASE_DOMAIN (non-interactive).
# ACME_EMAIL: with AUTO_SETUP=1 always admin@<BASE_DOMAIN> when BASE_DOMAIN is set; else only when empty or admin@domain.com.
patch_derived_env_keys() {
  local f="$1"
  local changed=0 bd acme

  if [[ -n "${EDGE_BASE_DOMAIN:-}" ]]; then
    bd="$(read_env_var BASE_DOMAIN "$f")"
    if [[ "$bd" == "example.com" ]]; then
      replace_env_line BASE_DOMAIN "$EDGE_BASE_DOMAIN" "$f"
      changed=1
    fi
  fi

  bd="$(read_env_var BASE_DOMAIN "$f")"
  acme="$(read_env_var ACME_EMAIL "$f")"
  if [[ -n "$bd" ]]; then
    if [[ "${AUTO_SETUP:-1}" == "1" ]]; then
      if [[ "$acme" != "admin@${bd}" ]]; then
        replace_env_line ACME_EMAIL "admin@${bd}" "$f"
        changed=1
      fi
    elif [[ -z "$acme" || "$acme" == "admin@domain.com" ]]; then
      replace_env_line ACME_EMAIL "admin@${bd}" "$f"
      changed=1
    fi
  fi

  [[ "$changed" -eq 1 ]] && return 0
  return 1
}

# Non-interactive: example.com, empty, or missing BASE_DOMAIN → EDGE_BASE_DOMAIN or localhost (CI / one-shot deploy).
auto_set_base_domain() {
  local f="$1"
  local bd
  bd="$(read_env_var BASE_DOMAIN "$f")"
  if [[ -z "$bd" || "$bd" == "example.com" ]]; then
    if [[ -n "${EDGE_BASE_DOMAIN:-}" ]]; then
      replace_env_line BASE_DOMAIN "$EDGE_BASE_DOMAIN" "$f"
      log "BASE_DOMAIN set from EDGE_BASE_DOMAIN=$EDGE_BASE_DOMAIN"
    else
      replace_env_line BASE_DOMAIN "localhost" "$f"
      log "BASE_DOMAIN defaulted to localhost (export EDGE_BASE_DOMAIN for production / public TLS)"
    fi
  fi
}

# After copying .env.example → .env: interactive domain only when AUTO_SETUP=0.
prompt_user_base_domain_first_install() {
  local f="$1"
  local bd input
  bd="$(read_env_var BASE_DOMAIN "$f")"
  [[ "$bd" == "example.com" ]] || return 0

  if [[ -n "${EDGE_BASE_DOMAIN:-}" ]]; then
    replace_env_line BASE_DOMAIN "$EDGE_BASE_DOMAIN" "$f"
    log "Set BASE_DOMAIN from EDGE_BASE_DOMAIN."
    return 0
  fi
  if [[ ! -t 0 ]]; then
    log "BASE_DOMAIN is still example.com (non-interactive shell). Set EDGE_BASE_DOMAIN before re-running, or edit $f."
    return 0
  fi
  printf '\n' >&2
  log "First install: type the public hostname for this stack (saved as BASE_DOMAIN in .env)."
  printf '      Press Enter to keep example.com for a local-only machine.\n' >&2
  read -r -p "      Domain: " input || true
  input="${input//$'\r'/}"
  input="${input#"${input%%[![:space:]]*}"}"
  input="${input%"${input##*[![:space:]]}"}"
  if [[ -n "$input" ]]; then
    replace_env_line BASE_DOMAIN "$input" "$f"
    log "Set BASE_DOMAIN to $input."
  fi
}

run_base_domain_setup() {
  local f="$1"
  if [[ "${AUTO_SETUP:-1}" == "1" ]]; then
    auto_set_base_domain "$f"
  else
    prompt_user_base_domain_first_install "$f"
  fi
}

# Align CORS with default panel hostname (edgecontrol.<BASE_DOMAIN>) when using AUTO_SETUP and a public-ish domain.
maybe_auto_cors_origin() {
  local f="$1"
  [[ "${AUTO_SETUP:-1}" == "1" ]] || return 0
  [[ -f "$f" ]] || return 0
  if ! grep -q "^CORS_ORIGIN=" "$f" 2>/dev/null; then
    return 0
  fi
  local bd ph origin
  bd="$(read_env_var BASE_DOMAIN "$f")"
  [[ -n "$bd" ]] || return 0
  if [[ "$bd" == "localhost" || "$bd" == "example.com" ]]; then
    replace_env_line CORS_ORIGIN "http://127.0.0.1:8080" "$f"
    log "CORS_ORIGIN set for local panel (loopback :8080)."
    return 0
  fi
  ph="$(read_env_var PANEL_HOST "$f")"
  if [[ -n "$ph" ]]; then
    origin="https://${ph}"
  else
    origin="https://edgecontrol.${bd}"
  fi
  replace_env_line CORS_ORIGIN "$origin" "$f"
  log "CORS_ORIGIN set to ${origin} (browser origin for Traefik panel)."
}

warn_localhost_in_production() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local bd ne
  bd="$(read_env_var BASE_DOMAIN "$f")"
  ne="$(read_env_var NODE_ENV "$f")"
  if [[ "$bd" == "localhost" && "$ne" == "production" ]]; then
    warn "BASE_DOMAIN is localhost while NODE_ENV=production — use EDGE_BASE_DOMAIN for a real FQDN before exposing the stack."
  fi
}

# Keep TRAEFIK_DYNAMIC_CONFIG_PATH in line with .env.example (older checkouts used dynamic.yml).
sync_traefik_env_with_example() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local v
  v="$(read_env_var TRAEFIK_DYNAMIC_CONFIG_PATH "$f")"
  if [[ -z "$v" || "$v" == "/traefik-config/dynamic.yml" ]]; then
    replace_env_line TRAEFIK_DYNAMIC_CONFIG_PATH "/traefik-config/dynamic.d/01-managed.yml" "$f"
    log "Updated TRAEFIK_DYNAMIC_CONFIG_PATH to /traefik-config/dynamic.d/01-managed.yml (matches .env.example)."
  fi
}

# Matches .env.example placeholder — treat as "must replace".
JWT_SECRET_PLACEHOLDER='change_me_use_openssl_rand_hex_32_chars_minimum'

# Fill only weak or empty values (does not rotate a valid JWT or existing DB password).
patch_insecure_or_missing_secrets() {
  local f="$1"
  local changed=0
  local v np

  if ! command -v openssl >/dev/null 2>&1; then
    v="$(read_env_var JWT_SECRET "$f")"
    if [[ -z "$v" || ${#v} -lt 32 || "$v" == "$JWT_SECRET_PLACEHOLDER" ]]; then
      warn "openssl not found — cannot auto-fill JWT_SECRET / JWT_REFRESH_SECRET / DB_PASSWORD in $f"
    fi
    return 1
  fi

  v="$(read_env_var JWT_SECRET "$f")"
  if [[ -z "$v" || ${#v} -lt 32 || "$v" == "$JWT_SECRET_PLACEHOLDER" ]]; then
    replace_env_line JWT_SECRET "$(openssl rand -hex 32)" "$f"
    changed=1
  fi

  v="$(read_env_var JWT_REFRESH_SECRET "$f")"
  if [[ -z "$v" || ${#v} -lt 32 ]]; then
    if grep -q "^JWT_REFRESH_SECRET=" "$f" 2>/dev/null; then
      replace_env_line JWT_REFRESH_SECRET "$(openssl rand -hex 32)" "$f"
    else
      printf '\nJWT_REFRESH_SECRET=%s\n' "$(openssl rand -hex 32)" >>"$f"
    fi
    changed=1
  fi

  v="$(read_env_var DB_PASSWORD "$f")"
  if [[ -z "$v" ]]; then
    np=$(openssl rand -hex 24)
    replace_env_line DB_PASSWORD "$np" "$f"
    replace_env_line DATABASE_URL "postgresql://admin:${np}@db:5432/edgecontrol" "$f"
    changed=1
  fi

  v="$(read_env_var REDIS_URL "$f")"
  case "$v" in
    ''|redis://:@redis:6379)
      replace_env_line REDIS_URL "redis://redis:6379" "$f"
      changed=1
      ;;
    redis://*@redis:6379)
      # Legacy template redis://:password@redis:6379 — bundled compose uses passwordless Redis on the internal network.
      replace_env_line REDIS_URL "redis://redis:6379" "$f"
      changed=1
      ;;
  esac

  v="$(read_env_var WEBHOOK_ALERT_SECRET "$f")"
  if [[ -z "$v" ]]; then
    replace_env_line WEBHOOK_ALERT_SECRET "$(openssl rand -hex 32)" "$f"
    changed=1
  fi

  v="$(read_env_var GRAFANA_ADMIN_PASSWORD "$f")"
  if [[ -z "$v" || "$v" == "ChangeMeGrafana!" ]]; then
    replace_env_line GRAFANA_ADMIN_PASSWORD "$(openssl rand -hex 16)" "$f"
    changed=1
  fi

  v="$(read_env_var MINIO_ROOT_PASSWORD "$f")"
  if [[ -z "$v" || "$v" == "ChangeMeMinioRoot!" ]]; then
    replace_env_line MINIO_ROOT_PASSWORD "$(openssl rand -hex 24)" "$f"
    changed=1
  fi

  if patch_derived_env_keys "$f"; then
    changed=1
  fi

  [[ "$changed" -eq 1 ]] && return 0
  return 1
}

# mode: "strict" (full|compose — require usable .env) or "bootstrap" (warn if .env cannot be created).
ensure_env_for_stack() {
  local mode="${1:-strict}"
  local ENV_EXAMPLE="$ROOT/.env.example"
  local ENV_FILE="$ROOT/.env"
  local bak

  if [[ "${FORCE_ENV_SYNC:-0}" == "1" ]]; then
    [[ -f "$ENV_EXAMPLE" ]] || die "FORCE_ENV_SYNC=1 requires $ENV_EXAMPLE"
    if [[ -f "$ENV_FILE" ]]; then
      bak="${ENV_FILE}.bak.$(date +%s)"
      cp "$ENV_FILE" "$bak"
      rm -f "$ENV_FILE"
      warn "FORCE_ENV_SYNC=1: existing .env saved as $bak — recreated from .env.example (re-run secrets/patch below)."
    fi
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ "${COPY_ENV:-1}" != "1" ]] || [[ ! -f "$ENV_EXAMPLE" ]]; then
      if [[ "$mode" == "bootstrap" ]]; then
        warn "No $ENV_FILE found. Create it from .env.example (set COPY_ENV=1 to auto-copy) before running the stack."
        return 1
      fi
      die "No .env at $ENV_FILE. Copy .env.example or run with COPY_ENV=1 when .env.example exists."
    fi
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    log "Created $ENV_FILE from .env.example."
    run_base_domain_setup "$ENV_FILE"
    if [[ "${GENERATE_SECRETS:-1}" == "1" || "${AUTO_SETUP:-1}" == "1" ]]; then
      if [[ "${GENERATE_SECRETS:-1}" == "1" ]]; then
        apply_generated_secrets "$ENV_FILE" || die "openssl is required to generate secrets (install openssl) or set secrets in $ENV_FILE manually."
        log "Generated secrets in $ENV_FILE (JWT, JWT_REFRESH_SECRET, DB, MinIO, Grafana; REDIS_URL set for internal compose). RBAC seed users are static in packages/db/prisma/seeds/rbac.seed.ts."
      fi
    else
      warn "GENERATE_SECRETS=0 — fill JWT_SECRET, JWT_REFRESH_SECRET (optional; API falls back to JWT_SECRET if unset), DB_PASSWORD, DATABASE_URL, REDIS_URL, and URLs in $ENV_FILE yourself."
    fi
  else
    if [[ "${AUTO_SETUP:-1}" == "1" ]]; then
      auto_set_base_domain "$ENV_FILE"
    fi
  fi

  [[ -f "$ENV_FILE" ]] || return 1

  # Append missing keys from .env.example *before* openssl patch so the same run replaces e.g. ChangeMeMinioRoot! (Compose requires MINIO_ROOT_PASSWORD).
  sync_missing_keys_from_example "$ENV_EXAMPLE" "$ENV_FILE"
  if [[ "${GENERATE_SECRETS:-1}" == "1" || "${AUTO_SETUP:-1}" == "1" ]]; then
    if patch_insecure_or_missing_secrets "$ENV_FILE"; then
      log "Filled missing or default credentials in $ENV_FILE (openssl)."
    fi
  fi
  sync_traefik_env_with_example "$ENV_FILE"
  maybe_auto_cors_origin "$ENV_FILE"
  warn_localhost_in_production "$ENV_FILE"
  ensure_traefik_static_rendered

  if [[ "$mode" == "strict" ]]; then
    local dbchk jwchk mp
    dbchk="$(read_env_var DB_PASSWORD "$ENV_FILE")"
    [[ -n "$dbchk" ]] || die "DB_PASSWORD must be set in $ENV_FILE"
    jwchk="$(read_env_var JWT_SECRET "$ENV_FILE")"
    [[ ${#jwchk} -ge 32 ]] || die "JWT_SECRET must be at least 32 characters in $ENV_FILE (install openssl and re-run, or set manually)."
    mp="$(read_env_var MINIO_ROOT_PASSWORD "$ENV_FILE")"
    [[ -n "$mp" ]] || die "MINIO_ROOT_PASSWORD is empty (docker compose requires it). Re-run with SYNC_ENV_FROM_EXAMPLE=1 or add MINIO_ROOT_PASSWORD=... to $ENV_FILE."
  fi
  return 0
}

# Warn when TLS hostnames will never get a public certificate from Let's Encrypt.
warn_letsencrypt_placeholder_domain() {
  local f="$ROOT/.env"
  [[ -f "$f" ]] || return 0
  local bd
  bd="$(read_env_var BASE_DOMAIN "$f")"
  if [[ "$bd" == "example.com" ]]; then
    warn "BASE_DOMAIN is still example.com — fine for local ACME_EMAIL hints; for **managed** Traefik routes (domains in the panel), use DNS names you control (Let's Encrypt rejects *.example.com). Or export EDGE_BASE_DOMAIN=... before bootstrap|full|compose."
  fi
}

read_env_var() {
  local key="$1" file="$2" line
  if [[ ! -f "$file" ]]; then
    echo ""
    return
  fi
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  printf '%s' "${line#${key}=}"
}

print_credentials_summary() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    return
  fi
  local v
  printf '\n'
  printf '%s\n' "═══════════════════════════════════════════════════════════════════"
  printf '%s\n' "  Edgecontrol — panel/API on host ports; Traefik for panel, MinIO, and managed routes (see README & compose)"
  printf '%s\n' "  Credentials from: $f"
  printf '%s\n' "  Treat as secret. Do not commit .env or paste into public channels."
  printf '%s\n' "═══════════════════════════════════════════════════════════════════"
  printf '\n%s\n' "Core"
  v="$(read_env_var NODE_ENV "$f")"
  printf '  %-30s %s\n' "NODE_ENV" "${v:-"(not set)"}"
  v="$(read_env_var API_PORT "$f")"
  printf '  %-30s %s\n' "API_PORT" "${v:-"(not set)"}"
  v="$(read_env_var JWT_SECRET "$f")"
  printf '  %-30s %s\n' "JWT_SECRET" "${v:-"(empty)"}"
  v="$(read_env_var JWT_REFRESH_SECRET "$f")"
  printf '  %-30s %s\n' "JWT_REFRESH_SECRET" "${v:-"(empty — API uses JWT_SECRET for refresh)"}"
  printf '\n%s\n' "Database & Redis"
  v="$(read_env_var DB_PASSWORD "$f")"
  printf '  %-30s %s\n' "DB_PASSWORD" "${v:-"(empty)"}"
  v="$(read_env_var DATABASE_URL "$f")"
  printf '  %-30s %s\n' "DATABASE_URL" "${v:-"(empty)"}"
  v="$(read_env_var REDIS_PASSWORD "$f")"
  [[ -n "$v" ]] && printf '  %-30s %s\n' "REDIS_PASSWORD (legacy)" "$v"
  v="$(read_env_var REDIS_URL "$f")"
  printf '  %-30s %s\n' "REDIS_URL" "${v:-"(empty)"}"
  printf '\n%s\n' "Panel / API (published on host — see docker-compose.yml)"
  for key in API_PUBLISH_PORT PANEL_PUBLISH_PORT PUBLIC_API_URL CORS_ORIGIN; do
    v="$(read_env_var "$key" "$f")"
    [[ -n "$v" ]] && printf '  %-30s %s\n' "$key" "$v"
  done
  printf '  %-30s %s\n' "→ if unset" "Compose uses 127.0.0.1:3001 (API) and :8080 (panel)"
  printf '\n%s\n' "Traefik / TLS (file: dynamic.d/00-static.yml MinIO + optional 01-managed.yml; Let’s Encrypt)"
  v="$(read_env_var ACME_EMAIL "$f")"
  printf '  %-30s %s\n' "ACME_EMAIL" "${v:-"(empty)"}"
  v="$(read_env_var BASE_DOMAIN "$f")"
  printf '  %-30s %s\n' "BASE_DOMAIN" "${v:-"(empty)"}"
  v="$(read_env_var CORS_ORIGIN "$f")"
  if [[ -z "$v" ]]; then
    printf '  %-30s %s\n' "CORS_ORIGIN" "(Compose default: http://127.0.0.1:<PANEL_PUBLISH_PORT>)"
  fi
  printf '\n%s\n' "MinIO"
  v="$(read_env_var MINIO_ROOT_USER "$f")"
  printf '  %-30s %s\n' "MINIO_ROOT_USER" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_ROOT_PASSWORD "$f")"
  printf '  %-30s %s\n' "MINIO_ROOT_PASSWORD" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_BUCKET "$f")"
  printf '  %-30s %s\n' "MINIO_BUCKET" "${v:-"(empty)"}"
  printf '\n%s\n' "Webhooks & integrations"
  v="$(read_env_var WEBHOOK_ALERT_SECRET "$f")"
  printf '  %-30s %s\n' "WEBHOOK_ALERT_SECRET" "${v:-"(empty)"}"
  v="$(read_env_var TELEGRAM_BOT_TOKEN "$f")"
  printf '  %-30s %s\n' "TELEGRAM_BOT_TOKEN" "${v:-"(empty)"}"
  v="$(read_env_var TELEGRAM_CHAT_ID "$f")"
  printf '  %-30s %s\n' "TELEGRAM_CHAT_ID" "${v:-"(empty)"}"
  printf '\n%s\n' "Prisma RBAC seed (first UI / API logins)"
  printf '  %-30s %s\n' "Seed users (static)" "see packages/db/prisma/seeds/rbac.seed.ts (domain + local parts)"
  printf '\n%s\n' "Grafana (observability UI — docker compose port 3010)"
  v="$(read_env_var GRAFANA_ADMIN_USER "$f")"
  printf '  %-30s %s\n' "GRAFANA_ADMIN_USER" "${v:-"(empty)"}"
  v="$(read_env_var GRAFANA_ADMIN_PASSWORD "$f")"
  printf '  %-30s %s\n' "GRAFANA_ADMIN_PASSWORD" "${v:-"(empty)"}"
  v="$(read_env_var GRAFANA_ROOT_URL "$f")"
  printf '  %-30s %s\n' "GRAFANA_ROOT_URL" "${v:-"(empty)"}"
  printf '\n%s\n' "Other"
  v="$(read_env_var TRAEFIK_DYNAMIC_CONFIG_PATH "$f")"
  printf '  %-30s %s\n' "TRAEFIK_DYNAMIC_CONFIG_PATH" "${v:-"(not set)"}"
  v="$(read_env_var HEALTH_CHECK_INTERVAL_MS "$f")"
  printf '  %-30s %s\n' "HEALTH_CHECK_INTERVAL_MS" "${v:-"(not set)"}"
  printf '\n%s\n' "═══════════════════════════════════════════════════════════════════"
  printf '%s\n\n' "  Tip: capture this output with: ./scripts/${ME} 2>&1 | tee setup-credentials.log"
}

# After full|compose|bootstrap, remind operators to store secrets (respects SHOW_CREDENTIALS).
maybe_print_credentials() {
  local envf="${1:-$ROOT/.env}"
  if [[ "${SHOW_CREDENTIALS:-1}" != "1" ]]; then
    return 0
  fi
  if [[ -f "$envf" ]]; then
    print_credentials_summary "$envf"
  else
    warn "No $envf — cannot print credentials summary."
  fi
}

require_env_file() {
  [[ -f "${ROOT}/.env" ]] || die "create .env from .env.example (run ./scripts/${ME} or copy manually) and set secrets"
}

require_pnpm() {
  command -v pnpm >/dev/null 2>&1 || die "pnpm is required for ./scripts/${ME} apps (install via Corepack). For stack + DB use ./scripts/${ME} full|compose|db|seed — Docker only, no host pnpm."
}

# Traefik and peers attach to external network `public` (see docker-compose.yml).
ensure_public_network() {
  if docker network inspect public >/dev/null 2>&1; then
    return 0
  fi
  log "Creating external Docker network 'public' (required by docker-compose.yml)"
  docker network create public
}

# .env is preferred for compose interpolation; .env.example is enough for `compose down` when .env is absent.
compose_env_file_for_stack() {
  if [[ -f "$ROOT/.env" ]]; then
    printf '%s\n' "$ROOT/.env"
  elif [[ -f "$ROOT/.env.example" ]]; then
    printf '%s\n' "$ROOT/.env.example"
  else
    return 1
  fi
}

cmd_clean() {
  require_docker_cli
  [[ -f "$COMPOSE_FILE" ]] || die "missing $COMPOSE_FILE"

  local rmi_local=0 rm_public=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --images) rmi_local=1 ;;
      --public-network) rm_public=1 ;;
      -h|--help)
        cat <<EOF
${ME} clean — remove Edgecontrol containers and compose volumes (fresh DB / MinIO / certs in Docker).

  ./scripts/${ME} clean [--images] [--public-network]

  Default: docker compose down --remove-orphans --volumes (named volumes: pgdata, minio_data, …).

  --images           Also drop locally built images for this project (compose --rmi local).
  --public-network   Also run: docker network rm public
                     Only use if nothing else needs the shared external network "public".

Then reinstall:  ./scripts/${ME} full
EOF
        return 0
        ;;
      *)
        die "Unknown option: $1 (try: ./scripts/${ME} clean --help)"
        ;;
    esac
    shift
  done

  local envf
  envf="$(compose_env_file_for_stack)" || die "No .env or .env.example — cannot run compose down."
  if [[ "$envf" == "$ROOT/.env.example" ]]; then
    warn "No .env — using .env.example so compose can interpolate (MINIO/JWT, etc.)."
  fi

  log "Stopping stack and removing named volumes (Postgres, MinIO, Grafana, Prometheus, Lets Encrypt volume)…"
  local extra=()
  [[ "$rmi_local" -eq 1 ]] && extra+=(--rmi local)
  (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" --env-file "$envf" --profile migrate down --remove-orphans --volumes "${extra[@]}")

  if [[ "$rm_public" -eq 1 ]]; then
    if docker network inspect public >/dev/null 2>&1; then
      log "Removing external Docker network 'public' (--public-network)…"
      docker network rm public 2>/dev/null || warn "Could not remove network 'public' (still attached to a container?). Check: docker network inspect public"
    else
      log "Network 'public' is not present."
    fi
  else
    log "Left Docker network 'public' in place (external; other stacks may use it). Remove with: ./scripts/${ME} clean --public-network"
  fi

  echo ""
  echo "Docker clean finished. Recreate stack: ./scripts/${ME} full   or   ./scripts/${ME} compose"
}

compose_migrate_profile() {
  require_docker_cli
  (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" --env-file .env --profile migrate "$@")
}

migrate_via_docker() {
  [[ -f "$COMPOSE_FILE" ]] || die "missing $COMPOSE_FILE"
  require_env_file
  compose_migrate_profile run --rm migrate \
    pnpm --filter @edgecontrol/db exec prisma migrate deploy
}

reset_via_docker() {
  [[ -f "$COMPOSE_FILE" ]] || die "missing $COMPOSE_FILE"
  require_env_file
  compose_migrate_profile run --rm migrate \
    pnpm --filter @edgecontrol/db exec prisma migrate reset --force
}

seed_via_docker() {
  [[ -f "$COMPOSE_FILE" ]] || die "missing $COMPOSE_FILE"
  require_env_file
  compose_migrate_profile run --rm migrate \
    pnpm --filter @edgecontrol/db prisma:seed
}

cmd_compose() {
  require_docker_cli
  ensure_env_for_stack strict
  warn_letsencrypt_placeholder_domain
  ensure_public_network
  (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" --env-file .env up -d --build "$@")
  echo "Stack started. See docker-compose.yml; Traefik file routes in docker/traefik/dynamic.d/."
  maybe_print_credentials "$ROOT/.env"
}

cmd_db() {
  require_env_file
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$ROOT" && pnpm --filter @edgecontrol/db prisma:migrate:deploy)
  else
    require_docker_cli
    migrate_via_docker
  fi
  echo "Database migrations applied."
}

cmd_reset() {
  require_env_file
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$ROOT" && pnpm --filter @edgecontrol/db exec prisma migrate reset --force)
  else
    require_docker_cli
    reset_via_docker
  fi
  echo "Database reset completed."
}

cmd_seed() {
  require_env_file
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$ROOT" && pnpm --filter @edgecontrol/db prisma:seed)
  else
    require_docker_cli
    seed_via_docker
  fi
  echo "Database seed completed."
}

cmd_apps() {
  require_pnpm
  require_env_file
  (cd "$ROOT" && pnpm install)
  (cd "$ROOT" && pnpm run build)
  echo "Apps built (API + web + packages)."
}

cmd_full() {
  require_docker_cli
  ensure_env_for_stack strict
  warn_letsencrypt_placeholder_domain
  ensure_public_network
  echo "=== Edgecontrol full deploy (Docker — $ROOT) ==="

  echo ">>> Building images and starting containers..."
  (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" --env-file .env up -d --build)

  echo ">>> Database migrations (migrate service — API Dockerfile builder target)..."
  migrate_via_docker

  echo ""
  echo "=== Done ==="
  echo "API + web + dependencies are running via Docker Compose."
  maybe_print_credentials "$ROOT/.env"
}

usage() {
  cat <<EOF
Edgecontrol — ${ME}

Bootstrap (no arguments, or explicit \`bootstrap\`):
  ./scripts/${ME}
  ./scripts/${ME} bootstrap

  Environment (defaults 1 = on; set to 0 to skip):
    COPY_ENV, GENERATE_SECRETS, AUTO_SETUP, SYNC_ENV_FROM_EXAMPLE, DOCKER_PREP, INSTALL_DOCKER, SHOW_CREDENTIALS
    SHOW_CREDENTIALS=1: after bootstrap, full, and compose, print values to store securely (set 0 to suppress).
    AUTO_SETUP=1 (default): no domain prompt; BASE_DOMAIN becomes EDGE_BASE_DOMAIN or localhost when empty/example.com;
      ACME_EMAIL tracks admin@<BASE_DOMAIN>; CORS_ORIGIN aligned to panel (127.0.0.1:8080 for local, else https://edgecontrol.<domain> or PANEL_HOST).
      Set AUTO_SETUP=0 to restore interactive first-install prompt and conservative ACME_EMAIL derivation only when empty or admin@domain.com.
    GENERATE_SECRETS=1: full|compose|bootstrap create .env from .env.example if missing, then openssl-fill
      weak or empty secrets (JWT / JWT_REFRESH under 32 chars, empty DB password, ChangeMe* defaults, etc.) without rotating
      already-strong values. Set GENERATE_SECRETS=0 to manage .env entirely by hand (AUTO_SETUP=1 still runs patch for weak values).
    EDGE_BASE_DOMAIN (optional): public FQDN for the stack — used when BASE_DOMAIN would otherwise default to localhost (production / TLS).
      With AUTO_SETUP=1 there is no TTY prompt; export EDGE_BASE_DOMAIN on CI or VPS installs.
    SYNC_ENV_FROM_EXAMPLE=1 (default): after .env exists, append any keys from .env.example that are missing (never overwrites values).
      Set to 0 to disable. This is the lightweight "env migration" — not a full synchroniser.
    FORCE_ENV_SYNC=1: before bootstrap, backup existing .env to .env.bak.<epoch> and remove it so the next run recreates from .env.example
      (same as rm .env then full). Default 0. Use when you intentionally want a clean template + regenerated secrets.
    replace_env_line / patch_insecure only change values for keys already present; new keys come from SYNC_ENV_FROM_EXAMPLE or a fresh copy.
    Not auto-filled (external / must be real): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
    Prisma RBAC seed is static in packages/db/prisma/seeds/rbac.seed.ts (emails + password). Docker migrate bind-mounts ./packages/db/prisma (not the whole db package) so seed/migrations track the host without breaking pnpm/prisma in the image.
    INSTALL_DOCKER also applies to deploy: if the docker CLI is missing, try install (macOS: Homebrew cask; Linux: get.docker.com) before full|compose|db|seed|reset (Docker path).

Deploy commands (stack = Docker only; no host pnpm):
  ./scripts/${ME} full      — .env + secrets if needed, render Traefik static routes, docker compose up --build + Prisma migrate
  ./scripts/${ME} compose   — .env + secrets if needed, render Traefik static routes, docker compose up -d --build
  ./scripts/${ME} db        — prisma migrate deploy (host pnpm if installed, else Docker migrate service)
  ./scripts/${ME} db reset  — prisma migrate reset --force (DANGER: drops all DB data, re-applies migrations)
  ./scripts/${ME} reset     — same as db reset
  ./scripts/${ME} seed      — prisma db seed (host pnpm if installed, else Docker)
  ./scripts/${ME} apps      — pnpm install + pnpm build (requires pnpm)

  ./scripts/${ME} clean [--images] [--public-network]
                            — compose down --volumes; optional image / public network removal (see clean --help)

  ./scripts/${ME} help      — this text

Other:
  ./scripts/render-traefik-static.sh — rewrite docker/traefik/dynamic.d/00-static.yml from .env (MinIO hosts only)
EOF
}

cmd_bootstrap() {
  log "Repository root: $ROOT"

  local ENV_EXAMPLE="$ROOT/.env.example"
  local ENV_FILE="$ROOT/.env"

  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    warn "Missing $ENV_EXAMPLE — create it or restore from version control."
  fi

  if [[ -f "$ENV_FILE" ]]; then
    log "Using $ENV_FILE (missing or default secrets are filled when GENERATE_SECRETS=1)."
  fi

  ensure_env_for_stack bootstrap || true

  if [[ "$DOCKER_PREP" == "1" ]]; then
    ensure_docker_on_path
    if ! command -v docker >/dev/null 2>&1; then
      if [[ "$INSTALL_DOCKER" == "1" ]]; then
        try_install_docker
        ensure_docker_on_path
      else
        warn "DOCKER_PREP is on but docker not found — skipping network creation (INSTALL_DOCKER=0)."
      fi
    fi
    if ! command -v docker >/dev/null 2>&1; then
      warn "DOCKER_PREP is on but docker CLI still not available — skipping network creation."
    elif ! docker info >/dev/null 2>&1; then
      warn "Docker is installed but the daemon is not running (or your user cannot access it). Start Docker Desktop / dockerd, add your user to the 'docker' group on Linux if needed, then create the network: docker network create public"
    else
      if docker network inspect public >/dev/null 2>&1; then
        log "Docker network 'public' already exists"
      else
        log "Creating Docker network 'public' (required by docker-compose.yml)"
        docker network create public
      fi
    fi
  fi

  log "Setup finished."

  maybe_print_credentials "$ENV_FILE"

  cat <<EOF

Next steps:
  • ./scripts/${ME} full      # compose + migrate (Docker only)
  • ./scripts/${ME} compose
  • After editing BASE_DOMAIN / MINIO_* in .env: ./scripts/render-traefik-static.sh && docker compose up -d --force-recreate traefik
  • Local dev: pnpm install && pnpm --filter @edgecontrol/db prisma:generate && pnpm dev
EOF
}

main() {
  local sub="${1:-}"
  if [[ -z "$sub" ]] || [[ "$sub" == "bootstrap" ]]; then
    if [[ "$sub" == "bootstrap" ]]; then
      shift || true
    fi
    if [[ $# -gt 0 ]]; then
      die "Unknown bootstrap argument(s): $* (bootstrap takes env vars only; try: ./scripts/${ME} help)"
    fi
    cmd_bootstrap
    return
  fi

  case "$sub" in
    -h|--help|help)
      usage
      ;;
    full)
      shift || true
      cmd_full "$@"
      ;;
    compose)
      shift || true
      cmd_compose "$@"
      ;;
    db)
      shift || true
      if [[ "${1:-}" == "reset" || "${1:-}" == "rezet" ]]; then
        shift || true
        cmd_reset "$@"
      else
        cmd_db "$@"
      fi
      ;;
    reset|rezet)
      shift || true
      cmd_reset "$@"
      ;;
    seed)
      shift || true
      cmd_seed "$@"
      ;;
    apps)
      shift || true
      cmd_apps "$@"
      ;;
    clean)
      shift || true
      cmd_clean "$@"
      ;;
    *)
      die "Unknown command: $sub (try: ./scripts/${ME} help)"
      ;;
  esac
}

main "$@"
