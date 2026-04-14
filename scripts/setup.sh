#!/usr/bin/env bash
# Local development bootstrap for the Edgecontrol monorepo.
# Run from anywhere: ./scripts/setup.sh  or  bash scripts/setup.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Defaults: all steps on. Set any to 0 to skip (e.g. RUN_MIGRATE=0 when no database yet).
COPY_ENV="${COPY_ENV:-1}"
GENERATE_SECRETS="${GENERATE_SECRETS:-1}"
RUN_MIGRATE="${RUN_MIGRATE:-1}"
RUN_SEED="${RUN_SEED:-1}"
RUN_BUILD="${RUN_BUILD:-1}"
RUN_TEST="${RUN_TEST:-1}"
DOCKER_PREP="${DOCKER_PREP:-1}"
INSTALL_DOCKER="${INSTALL_DOCKER:-1}"

log() { printf '\033[0;32m[%s]\033[0m %s\n' "$(date '+%H:%M:%S')" "$*"; }
warn() { printf '\033[0;33m[%s]\033[0m %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }
die() { warn "$*"; exit 1; }

# Install Docker when the CLI is missing (DOCKER_PREP + INSTALL_DOCKER). macOS: Homebrew cask; Linux: get.docker.com.
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

# Replace KEY=value in .env (key must match line start). Uses @ as sed delimiter; values are hex-only.
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

# Fill JWT / DB / Redis / webhook / admin & seed passwords. Updates DATABASE_URL and REDIS_URL with embedded credentials (hex, URL-safe).
apply_generated_secrets() {
  local f="$1"
  if ! command -v openssl >/dev/null 2>&1; then
    warn "openssl not found — cannot generate secrets. Install OpenSSL or set values in $f manually."
    return 1
  fi
  local jwt dbpw rspw wh seedpw
  jwt=$(openssl rand -hex 32)
  dbpw=$(openssl rand -hex 24)
  rspw=$(openssl rand -hex 24)
  wh=$(openssl rand -hex 32)
  seedpw=$(openssl rand -hex 16)
  replace_env_line JWT_SECRET "$jwt" "$f"
  replace_env_line DB_PASSWORD "$dbpw" "$f"
  replace_env_line REDIS_PASSWORD "$rspw" "$f"
  replace_env_line WEBHOOK_ALERT_SECRET "$wh" "$f"
  replace_env_line RBAC_SEED_PASSWORD "$seedpw" "$f"
  replace_env_line ADMIN_PASSWORD "$seedpw" "$f"
  replace_env_line DATABASE_URL "postgresql://admin:${dbpw}@db:5432/edgecontrol" "$f"
  # Default compose stack uses Redis without ACL; password is stored for production / custom compose.
  replace_env_line REDIS_URL "redis://redis:6379" "$f"
}

usage() {
  cat <<'EOF'
Edgecontrol — workspace setup

Usage:
  ./scripts/setup.sh
  RUN_MIGRATE=0 RUN_SEED=0 ./scripts/setup.sh   # dependencies + Prisma client only (no DB)

Environment (each defaults to 1 = run; set to 0 to skip):
  COPY_ENV         Copy .env.example → .env when .env is missing
  GENERATE_SECRETS After creating .env, fill JWT / DB / Redis / webhook / admin & RBAC seed passwords (openssl rand). Set to 0 to keep placeholders.
  RUN_MIGRATE      `prisma migrate deploy` (needs DATABASE_URL reachable)
  RUN_SEED         `prisma db seed`
  RUN_BUILD        `pnpm build` (turbo)
  RUN_TEST         `pnpm test` (turbo)
  DOCKER_PREP      Create Docker network `public` if missing (for docker-compose.yml)
  INSTALL_DOCKER   If Docker CLI is missing and DOCKER_PREP=1, attempt install (macOS: brew; Linux: get.docker.com). Default 1; set 0 to skip.

Examples:
  docker compose up -d db redis    # then ./scripts/setup.sh with a DATABASE_URL that points at Postgres
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help|help) usage; exit 0 ;;
    *) die "Unknown argument: $arg (try --help)" ;;
  esac
done

# --- Prerequisites ----------------------------------------------------------

log "Repository root: $ROOT"

if ! command -v node >/dev/null 2>&1; then
  die "Node.js is not installed. Install an LTS release (e.g. v20 or v22) and retry."
fi

NODE_MAJOR="$(node -p 'parseInt(process.versions.node, 10)')"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  warn "Node.js $(node --version) is older than v18; Prisma and tooling may fail."
fi

if ! command -v pnpm >/dev/null 2>&1; then
  die "pnpm is not on PATH. Install with: corepack enable && corepack prepare pnpm@10.18.3 --activate"
fi

log "Using Node $(node --version), pnpm $(pnpm --version)"

# --- Environment file -------------------------------------------------------

ENV_EXAMPLE="$ROOT/.env.example"
ENV_FILE="$ROOT/.env"
ENV_JUST_CREATED=0

if [[ ! -f "$ENV_EXAMPLE" ]]; then
  warn "Missing $ENV_EXAMPLE — create it or restore from version control."
fi

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "$COPY_ENV" == "1" ]] && [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    ENV_JUST_CREATED=1
    log "Created $ENV_FILE from .env.example."
  else
    warn "No $ENV_FILE found. Create it from .env.example before running the API or Prisma against a real DB."
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

# Prisma and seed read DATABASE_URL from .env (resolved from the repo root).

# --- Docker network ---------------------------------------------------------

if [[ "$DOCKER_PREP" == "1" ]]; then
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

# --- Dependencies & Prisma --------------------------------------------------

log "Installing workspace dependencies (pnpm install)..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

log "Generating Prisma client..."
pnpm --filter @edgecontrol/db prisma:generate

# --- Migrations -------------------------------------------------------------

if [[ "$RUN_MIGRATE" == "1" ]]; then
  log "Applying database migrations (prisma migrate deploy)..."
  pnpm --filter @edgecontrol/db prisma:migrate:deploy
fi

# --- Seed -------------------------------------------------------------------

if [[ "$RUN_SEED" == "1" ]]; then
  log "Seeding database..."
  pnpm --filter @edgecontrol/db prisma:seed
fi

# --- Build & tests ----------------------------------------------------------

if [[ "$RUN_BUILD" == "1" ]]; then
  log "Running production build (turbo)..."
  pnpm build
fi

if [[ "$RUN_TEST" == "1" ]]; then
  log "Running tests (turbo)..."
  pnpm test
fi

# --- Done -------------------------------------------------------------------

log "Setup finished."

cat <<'EOF'

Next steps (typical):
  • If you skipped secret generation, edit .env (JWT, DB/Redis passwords, DATABASE_URL / REDIS_URL).
  • docker compose up -d   — full stack (network `public` is created by this script when DOCKER_PREP=1).
  • pnpm dev               — API + web via Turborepo.

Prisma (new migration during development):
  pnpm --filter @edgecontrol/db prisma:migrate:dev

No database yet? Re-run with: RUN_MIGRATE=0 RUN_SEED=0 ./scripts/setup.sh
EOF
