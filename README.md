# Edgecontrol

Monorepo for a **Traefik-centric operations panel**: manage dynamic routing configuration, monitor service health, and enforce RBAC. The API (NestJS) writes **`docker/traefik/dynamic.d/01-managed.yml`**; panel and MinIO use **`00-static.yml`** rendered from **`.env`**; a worker processes background jobs (BullMQ / Redis); the web app is built with Vite and React.

On **Linux servers** it is usual to keep this checkout under **`/opt/stack`** or **`/opt/apps`** (for example `/opt/stack/edgecontrol`). Use that base consistently for Compose volumes, Traefik mounts, and systemd paths — see [Host checkout path (Linux)](#host-checkout-path-linux) under Docker Compose.

## Stack

| Area | Technology |
|------|------------|
| Workspace | [pnpm](https://pnpm.io/), [Turborepo](https://turbo.build/) |
| API | NestJS, tRPC |
| Web | Vite, React, Tailwind CSS |
| Data | PostgreSQL ([Prisma](https://www.prisma.io/)), Redis |
| Edge | Traefik v3 (file `dynamic.d/` + optional Docker provider, Let’s Encrypt) |
| Containers | Docker Compose |

## Requirements

- **Docker** & **Docker Compose** — required for the full stack (`docker compose`); migrations/seed without host Node use the `migrate` service (see `./scripts/setup.sh help`). With `INSTALL_DOCKER=1` (default), `./scripts/setup.sh` can install Docker when the CLI is missing (Linux: get.docker.com; macOS: Homebrew cask).
- **OpenSSL** — used by `scripts/setup.sh` to generate secrets
- **Node.js** 18+ and **pnpm** 10.x — for local development only (`pnpm dev`, Turbo). Corepack:  
  `corepack enable && corepack prepare pnpm@10.18.3 --activate`

## Quick start

```bash
git clone https://github.com/marloxxx/edgecontrol.git
cd edgecontrol
./scripts/setup.sh help       # bootstrap + deploy commands
./scripts/setup.sh            # .env + secrets + Docker network `public` (no Node)
./scripts/setup.sh full       # .env + secrets if needed, then compose + migrate (Docker only; no host pnpm)
```

On a server you might clone into **`/opt/stack`** or **`/opt/apps`** instead:

```bash
sudo mkdir -p /opt/stack && cd /opt/stack
sudo git clone https://github.com/marloxxx/edgecontrol.git
cd edgecontrol
./scripts/setup.sh
./scripts/setup.sh full
```

On first run `setup.sh` (or **`setup.sh full` / `compose`**) can:

- Copy `.env.example` → `.env` if it is missing, and **generate secrets** with OpenSSL (JWT, DB password, webhook secret, admin/RBAC seed password, Grafana/MinIO defaults, and a concrete `DATABASE_URL`)
- If `.env` already exists, **only fill** empty, short JWT, or obvious `ChangeMe*` / example placeholders — strong values you set are not rotated
- Optional: `export EDGE_BASE_DOMAIN=your.panel.host` before `full` / `compose` / `bootstrap` to replace `BASE_DOMAIN=example.com`; **ACME_EMAIL** is then set to `admin@<BASE_DOMAIN>` when it is still the example `admin@domain.com`
- **Telegram** tokens are never generated (they must come from BotFather). **RBAC seed emails** default to **`<role>@<BASE_DOMAIN>`** (for example **`superadmin@example.com`**) unless **`RBAC_*_EMAIL`** is set; **`ADMIN_EMAIL`** defaults from **`BASE_DOMAIN`** when empty (see **`packages/db/prisma/seeds/rbac.seed.ts`**)
- Create the external Docker network **`public`** (required by `docker-compose.yml`; `full` / `compose` do this automatically)
- Sync **`TRAEFIK_DYNAMIC_CONFIG_PATH`** with **`.env.example`** when it is missing or still **`/traefik-config/dynamic.yml`**, and render **`docker/traefik/dynamic.d/00-static.yml`** from **`.env`** — happens on **`setup.sh`** (bootstrap / **`full`** / **`compose`**); you can still run **`./scripts/render-traefik-static.sh`** by hand after editing hostnames

**Never commit `.env`.** Only `.env.example` is tracked.

### Database migrations and seed

Migrations live under `packages/db/prisma/migrations`. If **`migrate deploy` fails** after a bad history (for example P3018 on a fresh volume), wipe the Postgres volume and redeploy: `./scripts/setup.sh clean` then `./scripts/setup.sh full`. Do not wipe production data unless you intend to lose it.

With **pnpm** on the host (typical laptop):

```bash
pnpm --filter @edgecontrol/db prisma:migrate:deploy
pnpm --filter @edgecontrol/db prisma:seed
```

On a **Docker-only host** (no Node), use the deploy helper (runs Prisma inside the `migrate` Compose service — same `builder` image as the API):

```bash
./scripts/setup.sh db
./scripts/setup.sh db reset   # DANGER: wipes the database and reapplies migrations (then run seed)
./scripts/setup.sh seed
```

## Development

```bash
pnpm dev              # all packages with a dev script (Turbo)
pnpm dev:api          # API only (@edgecontrol/api)
pnpm dev:web          # Web only (@edgecontrol/web)
```

Use `.env` for local URLs (e.g. `DATABASE_URL`, `CORS_ORIGIN`, `JWT_SECRET`). Seed passwords use **`RBAC_SEED_PASSWORD`** / per-role overrides; seed emails follow **`BASE_DOMAIN`** unless overridden in **`.env`**.

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

The root **`docker-compose.yml`** runs Traefik, API, worker, web, Postgres, Redis, **Prometheus**, and **Grafana** on a single host.

1. Ensure `.env` exists and is filled (run `./scripts/setup.sh` once, or copy from `.env.example`).
2. External network **`public`**: `./scripts/setup.sh full` or `./scripts/setup.sh compose` creates it if missing (bootstrap with `DOCKER_PREP=1` does the same). Or once manually: `docker network create public`.
3. Start everything: `./scripts/setup.sh full` or `docker compose up -d --build`

**Tear down and wipe Docker state** (containers + named volumes such as Postgres data, MinIO, Grafana, Prometheus, Traefik’s `letsencrypt` volume) so you can reinstall from scratch:

```bash
./scripts/setup.sh clean --help    # options
./scripts/setup.sh clean           # down --volumes --remove-orphans
./scripts/setup.sh clean --images  # also remove locally built compose images (--rmi local)
./scripts/setup.sh clean --public-network   # also remove shared network "public" (only if safe on this host)
./scripts/setup.sh full            # bring stack back
```

`.env` on disk is unchanged; delete or regenerate it yourself if you also want new secrets.

**Panel and API:** you can use **loopback** (**`http://127.0.0.1:8080`** / **`:3001`**) or **Traefik HTTPS** for the **panel only** on **`PANEL_HOST`** (default **`edgecontrol.<BASE_DOMAIN>`** — set **`BASE_DOMAIN`** or **`PANEL_HOST`** in `.env`, point **DNS** at the host). The API is **not** on Traefik; the panel **nginx** proxies **`/trpc`** and **`/api`** to **`http://api:3000`** on the Docker network. Set **`CORS_ORIGIN`** to the **exact** panel origin the browser uses (e.g. **`https://edgecontrol.example.com`** when using Traefik). Local **`pnpm dev`** defaults tRPC to **http://localhost:3001** unless **`VITE_API_URL`** is set.

**Traefik (file + optional Docker):** **`./docker/traefik/traefik.yml`** loads **`providers.file.directory`** → **`./docker/traefik/dynamic.d/`** (all **`*.yml`** merged). **`00-static.yml`** is generated from **`.env`** (**`BASE_DOMAIN`**, optional **`PANEL_HOST`** / **`MINIO_*_HOST`**) and defines the panel and MinIO routers (no Docker labels on **`web`** / **`minio`**, so no duplicate **Host** rules). **`01-managed.yml`** is written only by the API (**Regenerate** in the UI). **`providers.docker`** stays available for other labelled services. Compose sets **`DOCKER_INTERNAL_NETWORK`** for the Docker provider; see **`docker-compose.proxy.yml`** when attaching to an external **`proxy`** network. If **`https://edgecontrol.your-domain`** 404s, re-run **`./scripts/render-traefik-static.sh`**, check **`.env`** hostnames match DNS, then **`docker compose up -d --force-recreate traefik`**.

**Managed routes:** **Regenerate** in the UI after changing managed services; the API overwrites **`dynamic.d/01-managed.yml`** only (static routes in **`00-static.yml`** are unchanged).

**404 on :443:** if **Host** does not match the names in **`00-static.yml`** or a managed route, Traefik returns **404**. Set **`BASE_DOMAIN`** / **`PANEL_HOST`** / **`MINIO_*_HOST`**, run **`./scripts/render-traefik-static.sh`**, recreate **`traefik`**.

**MinIO behind Traefik:** hostnames in **`00-static.yml`** must match **`MINIO_BROWSER_REDIRECT_URL`** / **`MINIO_SERVER_URL`** (Compose still derives those from **`BASE_DOMAIN`** unless overridden). Shared **`proxy`** network: **`docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d`** and **`TRAEFIK_DOCKER_NETWORK=proxy`** — recreate **`traefik`**, **`web`**, **`minio`** so Traefik can reach backends on that network.

**ACME `rejectedIdentifier` / “forbidden by policy”:** Let’s Encrypt refuses some names (for example **`*.example.com`**). Use a real public hostname on **managed** services in the UI, with DNS to this host. **`BASE_DOMAIN`** in `.env` is mainly for **`ACME_EMAIL`** derivation (`admin@<BASE_DOMAIN>` when you still have the example placeholder); you can `export EDGE_BASE_DOMAIN=yourdomain.com` before `./scripts/setup.sh full` to replace `example.com`.

### Host checkout path (Linux)

On servers it is common to keep the clone under **`/opt/stack`** or **`/opt/apps`**, for example:

- `/opt/stack/edgecontrol` (or `/opt/stack/<repo-name>`)
- `/opt/apps/edgecontrol` (or `/opt/apps/<repo-name>`)

Use the same base path in Compose **volume mounts**, Traefik file-provider paths, backup jobs, and **systemd** `WorkingDirectory` / `ExecStart` so services resolve `./docker/...` and `.env` consistently.

### Topology: single host vs split VPS

The Compose file runs the **edge**, **app**, and **observability** roles on one machine for development. In production you may split them (public Traefik only, private app, private Prometheus/Grafana on a management network).

| Concern | All-in-one Compose | Split (e.g. three VPS) |
|--------|----------------------|-------------------------|
| Panel / API vs managed edge | **Loopback** ports and/or **Traefik :443** for the panel (hosts in **`dynamic.d/00-static.yml`**); API stays internal (**nginx** → **`http://api:3000`**). Extra routes from **`dynamic.d/01-managed.yml`**. | Same ideas; split Traefik to its own host if you prefer. |
| Prometheus scrape target | `api:3000` in [docker/prometheus/prometheus.yml](docker/prometheus/prometheus.yml) resolves on the Compose network. | Point `static_configs.targets` at the **app host’s private address** (and open the scrape path only between observability and app). |
| Grafana → Prometheus | `http://prometheus:9090` in provisioning. | Same hostname if both run in one observability stack; otherwise use the private Prometheus URL. |
| Host ports **9090** / **3010** | Published for local access; convenient for laptops. | Prefer binding to a **private interface**, removing public mappings, or firewall rules so Prometheus and Grafana are not exposed on the internet. |

Traefik load balancer health checks and the worker use **`/api/health`** (see `healthPath` on services). **`01-managed.yml`** is created only when the API has at least one managed route (it is **not** committed; an empty **`{}`** file would break Traefik’s merge with **`00-static.yml`**).

### Metrics and Traefik

- Prometheus should scrape **`http://<app>:3000/metrics`** over the **private** path (same Docker network or VPN), not via the public Traefik hostname.
- By default, `METRICS_ALLOW_PUBLIC=false`: if a request reaches `/metrics` **through a reverse proxy** that sets `X-Forwarded-For` (including Traefik), the API responds with **403**. Direct scrapes from Prometheus do not send that header.
- Set `METRICS_ALLOW_PUBLIC=true` only when you need to debug metrics through the edge (not recommended in production).

### Nodes and per-service metrics

- **Nodes** are optional records (display name + host/IP) you manage under **Nodes** in the UI. Linking a **service** to a node is for **labelling and clarity** only; Traefik upstreams still come from the service’s `targetHost` / `targetPort`.
- When **Register for Prometheus scraping** is enabled on a service, the API appends that target to [`docker/prometheus/file_sd/edgecontrol-services.json`](docker/prometheus/file_sd/edgecontrol-services.json) (mounted into both the API and Prometheus containers). A reload is triggered when `PROMETHEUS_RELOAD_URL` is set (Compose defaults).

**Observability (local Compose):** Prometheus is on **http://localhost:9090**; Grafana on **http://localhost:3010** with the Prometheus datasource pre-provisioned. Set `GRAFANA_ADMIN_PASSWORD` (and optionally `GRAFANA_ROOT_URL`) in `.env`.

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
  traefik/      # traefik.yml + dynamic.d/ (00-static from .env, 01-managed from API)
  prometheus/   # Prometheus scrape config
  grafana/      # Grafana provisioning + dashboards
scripts/
  setup.sh      # Bootstrap (.env, secrets, network) + deploy: full, compose, db, db reset, seed, reset, apps, clean
```

## Licensing

Private / internal — adjust when you publish or open-source the project.
