# Edgecontrol

Monorepo for a **Traefik-centric operations panel**: manage dynamic routing configuration, monitor service health, and enforce RBAC. The API (NestJS) writes Traefik’s `dynamic.yml`; a worker processes background jobs (BullMQ / Redis); the web app is built with Vite and React.

## Stack

| Area | Technology |
|------|------------|
| Workspace | [pnpm](https://pnpm.io/), [Turborepo](https://turbo.build/) |
| API | NestJS, tRPC |
| Web | Vite, React, Tailwind CSS |
| Data | PostgreSQL ([Prisma](https://www.prisma.io/)), Redis |
| Edge | Traefik v3 (file provider, Let’s Encrypt) |
| Containers | Docker Compose |

## Requirements

- **Node.js** 18+ (LTS 20 or 22 recommended)
- **pnpm** 10.x — enable via Corepack:  
  `corepack enable && corepack prepare pnpm@10.18.3 --activate`
- **OpenSSL** — used by `scripts/setup.sh` to generate secrets
- **Docker** & **Docker Compose** — optional; required for the full stack in Compose

## Quick start

```bash
git clone https://github.com/marloxxx/edgecontrol.git
cd edgecontrol
./scripts/setup.sh --help   # optional: see flags and env toggles
./scripts/setup.sh
```

On first run the script can:

- Copy `.env.example` → `.env` and **generate secrets** (JWT, DB password, webhook secret, admin/RBAC seed password, and a concrete `DATABASE_URL`)
- Create the external Docker network **`public`** (required by `docker-compose.yml`)
- Install dependencies, run `prisma generate`, migrate, seed, build, and tests (all configurable; see script help)

**Never commit `.env`.** Only `.env.example` is tracked.

### Database not running yet?

```bash
RUN_MIGRATE=0 RUN_SEED=0 ./scripts/setup.sh
```

Bring Postgres up (e.g. via Docker), then run migrations and seed:

```bash
pnpm --filter @edgecontrol/db prisma:migrate:deploy
pnpm --filter @edgecontrol/db prisma:seed
```

## Development

```bash
pnpm dev              # all packages with a dev script (Turbo)
pnpm dev:api          # API only (@edgecontrol/api)
pnpm dev:web          # Web only (@edgecontrol/web)
```

Use `.env` for local URLs (e.g. `DATABASE_URL`, `CORS_ORIGIN`, `JWT_SECRET`). Seed users and passwords come from the RBAC-related variables in `.env.example` (overridden when setup generates secrets).

Other useful commands:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

### New Prisma migration (development)

```bash
pnpm --filter @edgecontrol/db prisma:migrate:dev
```

## Docker Compose (full stack)

The root **`docker-compose.yml`** runs Traefik, API, worker, web, Postgres, and Redis on a single host.

1. Ensure `.env` exists and is filled (run `./scripts/setup.sh` once, or copy from `.env.example`).
2. Create the external network once (the setup script can do this when `DOCKER_PREP=1`):  
   `docker network create public`
3. Start everything:  
   `docker compose up -d --build`

Traefik reads `./docker/traefik/dynamic.yml` (the API updates route definitions at runtime). For HTTPS, set `ACME_EMAIL` and point DNS at the host.

## Repository layout

```
apps/
  api/          # NestJS HTTP API + worker entrypoints
  web/          # Vite + React UI
packages/
  db/           # Prisma schema, migrations, seeds
  trpc/         # Shared tRPC router types / client
  config/       # Shared configuration
docker/
  traefik/      # Traefik static/dynamic config mount paths
scripts/
  setup.sh      # Local bootstrap
```

## Licensing

Private / internal — adjust when you publish or open-source the project.
