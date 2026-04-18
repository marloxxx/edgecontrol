# Edgecontrol

Monorepo for a **Traefik-centric operations panel**: manage dynamic routing configuration, monitor service health, and enforce RBAC. The API (NestJS) writes Traefik’s `dynamic.yml`; a worker processes background jobs (BullMQ / Redis); the web app is built with Vite and React.

On **Linux servers** it is usual to keep this checkout under **`/opt/stack`** or **`/opt/apps`** (for example `/opt/stack/edgecontrol`). Use that base consistently for Compose volumes, Traefik mounts, and systemd paths — see [Host checkout path (Linux)](#host-checkout-path-linux) under Docker Compose.

## Stack

| Area | Technology |
|------|------------|
| Workspace | [pnpm](https://pnpm.io/), [Turborepo](https://turbo.build/) |
| API | NestJS, tRPC |
| Web | Vite, React, Tailwind CSS |
| Data | PostgreSQL ([Prisma](https://www.prisma.io/)), Redis |
| Edge | Traefik v3 (file provider + Let’s Encrypt for managed routes; no Docker provider) |
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
- **Telegram** tokens are never generated (they must come from BotFather). **RBAC / admin emails** stay as in `.env` unless you change them
- Create the external Docker network **`public`** (required by `docker-compose.yml`; `full` / `compose` do this automatically)

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

**Panel and API (no Traefik Docker labels):** open **http://127.0.0.1:8080** for the panel (default **`PANEL_PUBLISH_PORT`**). The panel image’s **nginx** forwards **`/trpc`** and **`/api`** to **`http://api:3000`**, so the SPA uses **same-origin** URLs by default (do not set empty **`VITE_API_URL`** / **`PUBLIC_API_URL`** keys in `.env`). For a custom API base in the built bundle, use **`docker compose build web --build-arg VITE_API_URL=…`**. Set **`CORS_ORIGIN`** to the panel origin the browser uses (for example `http://YOUR_VPS_IP:8080` when not on localhost). Direct API checks: **http://127.0.0.1:3001** (**`API_PUBLISH_PORT`**). Remote loopback-only access: **SSH port forwarding** or publish on **`0.0.0.0`** and firewall. **MinIO** stays on **127.0.0.1:9000** / **:9001**. Local **`pnpm dev`** defaults the tRPC client to **http://localhost:3001** unless **`VITE_API_URL`** is set.

**Traefik (file provider only):** reads `./docker/traefik/dynamic.yml`, which the **API rewrites** when you publish **managed** routes from the panel. Those routes use **HTTPS on :443** with **`ACME_EMAIL`** and Let’s Encrypt. Traefik does **not** use the Docker socket in this compose file.

**Managed routes: “404” or no certificate:** routers from `dynamic.yml` use **`websecure` only**; **http://** on :80 redirects to **https://** on :443. If **https://** 404s, the **Host** header must match the domain on the service record, DNS must point here, and Traefik must be running (`docker compose ps`). Recreate after config changes: `docker compose up -d --force-recreate traefik`.

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
| Panel / API vs managed edge | Host: published **loopback** ports to `web` / `api`; internal callers use `http://api:3000`. Managed routes go through **Traefik :443** from `dynamic.yml`. | Same ideas: private URLs in `dynamic.yml` for upstreams; expose panel/API via VPN or your own reverse proxy if not on loopback. |
| Prometheus scrape target | `api:3000` in [docker/prometheus/prometheus.yml](docker/prometheus/prometheus.yml) resolves on the Compose network. | Point `static_configs.targets` at the **app host’s private address** (and open the scrape path only between observability and app). |
| Grafana → Prometheus | `http://prometheus:9090` in provisioning. | Same hostname if both run in one observability stack; otherwise use the private Prometheus URL. |
| Host ports **9090** / **3010** | Published for local access; convenient for laptops. | Prefer binding to a **private interface**, removing public mappings, or firewall rules so Prometheus and Grafana are not exposed on the internet. |

Traefik load balancer health checks and the worker use **`/api/health`** (see `healthPath` on services). The example `dynamic.yml` matches that path.

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
  traefik/      # Traefik static/dynamic config mount paths
  prometheus/   # Prometheus scrape config
  grafana/      # Grafana provisioning + dashboards
scripts/
  setup.sh      # Bootstrap (.env, secrets, network) + deploy: full, compose, db, db reset, seed, reset, apps, clean
```

## Licensing

Private / internal — adjust when you publish or open-source the project.
