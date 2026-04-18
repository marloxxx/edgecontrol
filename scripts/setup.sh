#!/usr/bin/env bash
# Edgecontrol — one script: host bootstrap (no Node), or deploy (compose / Prisma / turbo).
# API image: apps/api/Dockerfile (pnpm install, prisma generate, build). Prisma without host
# pnpm uses the Compose `migrate` service (builder target).
# Run from repo root: ./scripts/setup.sh   or   bash scripts/setup.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE_FILE="${ROOT}/docker-compose.yml"
ME="${0##*/}"

COPY_ENV="${COPY_ENV:-1}"
GENERATE_SECRETS="${GENERATE_SECRETS:-1}"
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

require_docker_cli() {
  ensure_docker_on_path
  command -v docker >/dev/null 2>&1 || die "Docker CLI not found. Install Docker Engine: https://docs.docker.com/engine/install/"
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

replace_env_line() {
  local key="$1"
  local value="$2"
  local file="$3"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s@^${key}=.*@${key}=${value}@" "$file"
  else
    sed -i "s@^${key}=.*@${key}=${value}@" "$file"
  fi
}

apply_generated_secrets() {
  local f="$1"
  if ! command -v openssl >/dev/null 2>&1; then
    warn "openssl not found — cannot generate secrets. Install OpenSSL or set values in $f manually."
    return 1
  fi
  local jwt dbpw rspw wh seedpw minio_pw base
  jwt=$(openssl rand -hex 32)
  dbpw=$(openssl rand -hex 24)
  rspw=$(openssl rand -hex 24)
  wh=$(openssl rand -hex 32)
  seedpw=$(openssl rand -hex 16)
  minio_pw=$(openssl rand -hex 24)
  replace_env_line JWT_SECRET "$jwt" "$f"
  replace_env_line DB_PASSWORD "$dbpw" "$f"
  replace_env_line REDIS_PASSWORD "$rspw" "$f"
  replace_env_line WEBHOOK_ALERT_SECRET "$wh" "$f"
  replace_env_line RBAC_SEED_PASSWORD "$seedpw" "$f"
  replace_env_line ADMIN_PASSWORD "$seedpw" "$f"
  replace_env_line DATABASE_URL "postgresql://admin:${dbpw}@db:5432/edgecontrol" "$f"
  replace_env_line REDIS_URL "redis://redis:6379" "$f"
  replace_env_line GRAFANA_ADMIN_PASSWORD "$(openssl rand -hex 16)" "$f"
  replace_env_line MINIO_ROOT_PASSWORD "$minio_pw" "$f"
  base="$(read_env_var BASE_DOMAIN "$f")"
  base="${base//$'\r'/}"
  base="${base// /}"
  if [[ -n "$base" ]]; then
    replace_env_line MINIO_S3_DOMAIN "s3.${base}" "$f"
    replace_env_line MINIO_CONSOLE_DOMAIN "minio.${base}" "$f"
    replace_env_line MINIO_SERVER_URL "https://s3.${base}" "$f"
    replace_env_line MINIO_BROWSER_REDIRECT_URL "https://minio.${base}" "$f"
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
  printf '%s\n' "  Edgecontrol — VPS 1 role: public Traefik / edge (see README & compose)"
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
  v="$(read_env_var CORS_ORIGIN "$f")"
  printf '  %-30s %s\n' "CORS_ORIGIN" "${v:-"(not set)"}"
  printf '\n%s\n' "Database & Redis"
  v="$(read_env_var DB_PASSWORD "$f")"
  printf '  %-30s %s\n' "DB_PASSWORD" "${v:-"(empty)"}"
  v="$(read_env_var DATABASE_URL "$f")"
  printf '  %-30s %s\n' "DATABASE_URL" "${v:-"(empty)"}"
  v="$(read_env_var REDIS_PASSWORD "$f")"
  printf '  %-30s %s\n' "REDIS_PASSWORD" "${v:-"(empty)"}"
  v="$(read_env_var REDIS_URL "$f")"
  printf '  %-30s %s\n' "REDIS_URL" "${v:-"(empty)"}"
  printf '\n%s\n' "Traefik / TLS (VPS 1)"
  v="$(read_env_var ACME_EMAIL "$f")"
  printf '  %-30s %s\n' "ACME_EMAIL" "${v:-"(empty)"}"
  printf '\n%s\n' "MinIO (Traefik / TLS — set BASE_DOMAIN before first setup to auto-fill hostnames)"
  v="$(read_env_var BASE_DOMAIN "$f")"
  printf '  %-30s %s\n' "BASE_DOMAIN" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_ROOT_USER "$f")"
  printf '  %-30s %s\n' "MINIO_ROOT_USER" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_ROOT_PASSWORD "$f")"
  printf '  %-30s %s\n' "MINIO_ROOT_PASSWORD" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_BUCKET "$f")"
  printf '  %-30s %s\n' "MINIO_BUCKET" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_S3_DOMAIN "$f")"
  printf '  %-30s %s\n' "MINIO_S3_DOMAIN" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_CONSOLE_DOMAIN "$f")"
  printf '  %-30s %s\n' "MINIO_CONSOLE_DOMAIN" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_SERVER_URL "$f")"
  printf '  %-30s %s\n' "MINIO_SERVER_URL" "${v:-"(empty)"}"
  v="$(read_env_var MINIO_BROWSER_REDIRECT_URL "$f")"
  printf '  %-30s %s\n' "MINIO_BROWSER_REDIRECT_URL" "${v:-"(empty)"}"
  printf '\n%s\n' "Webhooks & integrations"
  v="$(read_env_var WEBHOOK_ALERT_SECRET "$f")"
  printf '  %-30s %s\n' "WEBHOOK_ALERT_SECRET" "${v:-"(empty)"}"
  v="$(read_env_var TELEGRAM_BOT_TOKEN "$f")"
  printf '  %-30s %s\n' "TELEGRAM_BOT_TOKEN" "${v:-"(empty)"}"
  v="$(read_env_var TELEGRAM_CHAT_ID "$f")"
  printf '  %-30s %s\n' "TELEGRAM_CHAT_ID" "${v:-"(empty)"}"
  printf '\n%s\n' "Admin & RBAC seed (UI / API users)"
  v="$(read_env_var ADMIN_EMAIL "$f")"
  printf '  %-30s %s\n' "ADMIN_EMAIL" "${v:-"(empty)"}"
  v="$(read_env_var ADMIN_PASSWORD "$f")"
  printf '  %-30s %s\n' "ADMIN_PASSWORD" "${v:-"(empty)"}"
  v="$(read_env_var RBAC_SEED_PASSWORD "$f")"
  printf '  %-30s %s\n' "RBAC_SEED_PASSWORD" "${v:-"(empty)"}"
  v="$(read_env_var RBAC_SUPER_ADMIN_EMAIL "$f")"
  printf '  %-30s %s\n' "RBAC_SUPER_ADMIN_EMAIL" "${v:-"(empty)"}"
  v="$(read_env_var RBAC_ADMIN_EMAIL "$f")"
  printf '  %-30s %s\n' "RBAC_ADMIN_EMAIL" "${v:-"(empty)"}"
  v="$(read_env_var RBAC_DEVELOPER_EMAIL "$f")"
  printf '  %-30s %s\n' "RBAC_DEVELOPER_EMAIL" "${v:-"(empty)"}"
  v="$(read_env_var RBAC_VIEWER_EMAIL "$f")"
  printf '  %-30s %s\n' "RBAC_VIEWER_EMAIL" "${v:-"(empty)"}"
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

require_env_file() {
  [[ -f "${ROOT}/.env" ]] || die "create .env from .env.example (run ./scripts/${ME} or copy manually) and set secrets"
}

require_pnpm() {
  command -v pnpm >/dev/null 2>&1 || die "pnpm is required for ./scripts/${ME} apps (install via Corepack). For stack + DB use ./scripts/${ME} full|compose|db|seed — Docker only, no host pnpm."
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
  require_env_file
  (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" --env-file .env up -d --build "$@")
  echo "Stack started. See docker-compose.yml for services and Traefik labels."
}

cmd_db() {
  require_env_file
  ensure_docker_on_path
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$ROOT" && pnpm --filter @edgecontrol/db prisma:migrate:deploy)
  elif command -v docker >/dev/null 2>&1; then
    migrate_via_docker
  else
    die "install Docker Engine, or pnpm for host migrations"
  fi
  echo "Database migrations applied."
}

cmd_reset() {
  require_env_file
  ensure_docker_on_path
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$ROOT" && pnpm --filter @edgecontrol/db exec prisma migrate reset --force)
  elif command -v docker >/dev/null 2>&1; then
    reset_via_docker
  else
    die "install Docker Engine, or pnpm for host reset"
  fi
  echo "Database reset completed."
}

cmd_seed() {
  require_env_file
  ensure_docker_on_path
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$ROOT" && pnpm --filter @edgecontrol/db prisma:seed)
  elif command -v docker >/dev/null 2>&1; then
    seed_via_docker
  else
    die "install Docker Engine, or pnpm for host seed"
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
  require_env_file
  echo "=== Edgecontrol full deploy (Docker — $ROOT) ==="

  echo ">>> Building images and starting containers..."
  (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" --env-file .env up -d --build)

  echo ">>> Database migrations (migrate service — API Dockerfile builder target)..."
  migrate_via_docker

  echo ""
  echo "=== Done ==="
  echo "API + web + dependencies are running via Docker Compose."
}

usage() {
  cat <<EOF
Edgecontrol — ${ME}

Bootstrap (no arguments, or explicit \`bootstrap\`):
  ./scripts/${ME}
  ./scripts/${ME} bootstrap

  Environment (defaults 1 = on; set to 0 to skip):
    COPY_ENV, GENERATE_SECRETS, DOCKER_PREP, INSTALL_DOCKER, SHOW_CREDENTIALS

Deploy commands:
  ./scripts/${ME} full      — docker compose up --build + Prisma migrate (no host pnpm)
  ./scripts/${ME} compose   — docker compose up -d --build
  ./scripts/${ME} db        — prisma migrate deploy (pnpm or Docker migrate service)
  ./scripts/${ME} reset     — prisma migrate reset --force (DANGER)
  ./scripts/${ME} seed      — prisma db seed (pnpm or Docker)
  ./scripts/${ME} apps      — pnpm install + pnpm build (requires pnpm)

  ./scripts/${ME} help      — this text
EOF
}

cmd_bootstrap() {
  log "Repository root: $ROOT"

  local ENV_EXAMPLE="$ROOT/.env.example"
  local ENV_FILE="$ROOT/.env"
  local ENV_JUST_CREATED=0

  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    warn "Missing $ENV_EXAMPLE — create it or restore from version control."
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ "$COPY_ENV" == "1" ]] && [[ -f "$ENV_EXAMPLE" ]]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      ENV_JUST_CREATED=1
      log "Created $ENV_FILE from .env.example."
    else
      warn "No $ENV_FILE found. Create it from .env.example before running the stack."
    fi
  else
    log "Using existing $ENV_FILE (secrets are not regenerated)"
  fi

  if [[ "$ENV_JUST_CREATED" == "1" ]] && [[ "$GENERATE_SECRETS" == "1" ]]; then
    log "Generating random secrets and passwords in $ENV_FILE..."
    apply_generated_secrets "$ENV_FILE"
    log "Done. Seed users share ADMIN_PASSWORD / RBAC_SEED_PASSWORD (see .env). Do not commit .env."
  elif [[ "$ENV_JUST_CREATED" == "1" ]] && [[ "$GENERATE_SECRETS" != "1" ]]; then
    warn "GENERATE_SECRETS=0 — fill JWT_SECRET, DB_PASSWORD, REDIS_PASSWORD, and URLs in $ENV_FILE yourself."
  fi

  if [[ "$DOCKER_PREP" == "1" ]]; then
    ensure_docker_on_path
    if ! command -v docker >/dev/null 2>&1; then
      if [[ "$INSTALL_DOCKER" == "1" ]]; then
        try_install_docker
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

  if [[ "${SHOW_CREDENTIALS}" == "1" ]] && [[ -f "$ENV_FILE" ]]; then
    print_credentials_summary "$ENV_FILE"
  elif [[ "${SHOW_CREDENTIALS}" == "1" ]] && [[ ! -f "$ENV_FILE" ]]; then
    warn "No $ENV_FILE — cannot print credentials summary."
  fi

  cat <<EOF

Next steps:
  • ./scripts/${ME} full      # compose + migrate (Docker only)
  • ./scripts/${ME} compose
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
      cmd_db "$@"
      ;;
    reset)
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
    *)
      die "Unknown command: $sub (try: ./scripts/${ME} help)"
      ;;
  esac
}

main "$@"
