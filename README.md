# Edgecontrol

Monorepo for a **Traefik-centric operations panel**: manage dynamic routing configuration, monitor service health, and enforce RBAC. The API (NestJS) writes **`docker/traefik/dynamic.d/01-managed.yml`**; **`00-static.yml`** (from **`.env`**) defines **panel + MinIO** Traefik routes; **`02-default-tls.yml`** wires the **default TLS** store to **`docker/traefik/ssl/cert.pem`** + **`key.pem`**; a worker processes background jobs (BullMQ / Redis); the web app is built with Vite and React.

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
- **Telegram** tokens are never generated (they must come from BotFather). **RBAC seed users** are **static** in **`packages/db/prisma/seeds/rbac.seed.ts`** (fixed emails under **`ptsi.co.id`** and one shared first-boot password); run **`./scripts/setup.sh seed`** to (re)apply them to the database
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

Use `.env` for local URLs (e.g. `DATABASE_URL`, `CORS_ORIGIN`, `JWT_SECRET`). RBAC seed users and password are **static** in **`packages/db/prisma/seeds/rbac.seed.ts`** (not read from **`.env`**).

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

**Panel and API:** use **loopback** (**`http://127.0.0.1:8080`** / **`:3001`**) or **Traefik HTTPS** for the panel on **`PANEL_HOST`** (default **`edgecontrol.<BASE_DOMAIN>`** — set in **`.env`**; **`00-static.yml`** is rendered with that host). You can still add extra hostnames as **managed** services in **`01-managed.yml`**. The API is **not** on Traefik; the panel **nginx** proxies **`/trpc`** and **`/api`** to **`http://api:3000`**. Set **`CORS_ORIGIN`** to the **exact** panel origin the browser uses. **`pnpm dev`** may set **`VITE_API_URL`** to point tRPC at a different API origin; **`vite build`** / the **`web`** Docker image always use **same-origin** **`/trpc`** (external **`VITE_API_URL`** is ignored in production bundles).

**Traefik (file provider only):** **`./docker/traefik/traefik.yml`** loads **`providers.file.directory`** → **`./docker/traefik/dynamic.d/`** (all **`*.yml`** merged). **Default TLS** (wildcard PEMs) must be declared in **dynamic** config: **`dynamic.d/02-default-tls.yml`** points at **`/etc/traefik/ssl/cert.pem`** + **`key.pem`** (Compose mounts **`./docker/traefik/ssl`**). Putting **`tls.stores`** only in **`traefik.yml`** static file does **not** load the same way in Traefik v3 — you would otherwise see Chrome’s **“TRAEFIK DEFAULT CERT”**. Run **`./scripts/ensure-traefik-ssl.sh`** for a local self-signed pair, or merge your **STAR** + bundle into **`cert.pem`** and the matching key into **`key.pem`**. **Panel + MinIO** and **managed** **`websecure`** routes do **not** use **`tls.certResolver`** (file TLS + wildcard). See **`docker-compose.proxy.yml`** when attaching Traefik, **`web`**, and **`minio`** to an external **`proxy`** network. Re-run **`./scripts/render-traefik-static.sh`**, **Regenerate** if needed, then **`docker compose up -d --force-recreate traefik`**.

**Managed routes:** **Regenerate** in the UI after changing managed services; the API overwrites **`dynamic.d/01-managed.yml`** only (panel / MinIO in **`00-static.yml`** are unchanged unless you re-render static).

**Public edge (VPS A) → private backend (VPS B):** run this Edgecontrol stack (and Traefik) on **A** — the host whose **public** IP has **DNS** for your site. Browsers only ever connect to **A** on **80/443**; TLS terminates on **A**. In the panel, add a **managed** service where **Public domain** is the real hostname (e.g. **`licentra.ptsi.co.id`**), **Target host** is **B’s private address** (RFC1918 IP or internal DNS name reachable **from A**), **Target port** is whatever **B** actually listens on (often **`80`** for plain HTTP behind the edge), and **Protocol** is **`http`** unless you intentionally proxy to **HTTPS** on B. Ensure **A → B** is allowed (firewall / cloud security group / VPN). **`passHostHeader: true`** is set only in **`TraefikService.buildConfig()`** (managed services → **`01-managed.yml`**), not in **`00-static.yml`**. Health probes send **`Host: <public domain>`** so a **second Traefik on B** can match **`Host()`** rules; if B’s Traefik returns **404** for the probe path, turn off **Traefik load-balancer health probe** for that service in the UI (traffic still proxies). **Regenerate**, then **`docker compose up -d --force-recreate traefik`** on **A**.

**404 on :443:** if **Host** does not match **`00-static.yml`** (panel / MinIO) or **`01-managed.yml`**, Traefik returns **404**. Set **`BASE_DOMAIN`**, **`PANEL_HOST`**, **`MINIO_*_HOST`**, run **`./scripts/render-traefik-static.sh`**, recreate **`traefik`**.

**MinIO behind Traefik:** hostnames in **`00-static.yml`** must match **`MINIO_BROWSER_REDIRECT_URL`** / **`MINIO_SERVER_URL`** (Compose still derives those from **`BASE_DOMAIN`** unless overridden). Shared **`proxy`** network: **`docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d`** — recreate **`traefik`**, **`web`**, **`minio`** so Traefik can reach backends on that network.

**ACME `rejectedIdentifier` / “forbidden by policy”:** Let’s Encrypt refuses some names (for example **`*.example.com`**). Use a real public hostname on **managed** services in the UI, with DNS to this host. **`BASE_DOMAIN`** in `.env` is mainly for **`ACME_EMAIL`** derivation (`admin@<BASE_DOMAIN>` when you still have the example placeholder); you can `export EDGE_BASE_DOMAIN=yourdomain.com` before `./scripts/setup.sh full` to replace `example.com`.

**ACME staging vs production:** Compose passes **`--certificatesresolvers.letsencrypt.acme.caserver`** from **`ACME_CA_SERVER`** (default **production** `https://acme-v02.api.letsencrypt.org/directory`). Set **`ACME_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory`** in **`.env`** only while debugging (staging certs are **not** trusted by browsers). Remove it or switch back to production before go-live; use a **separate** `acme.json` volume or delete staging data in **`letsencrypt`** if you flip between environments. **`docker compose up -d --force-recreate traefik`** after changes.

**Let’s Encrypt `429` / rateLimited (e.g. “too many certificates (5) already issued”):** production LE allows only **5 duplicate certificates per exact hostname set per week**. After repeated **`docker compose` / Traefik** restarts or mis-issued orders, wait until the **`retry after`** time in the log, use **staging** (`ACME_CA_SERVER`) only for tests, or stop requesting LE for those names (MinIO static routes now use **file TLS** only). Do **not** keep hammering production ACME — the window is rolling **168 hours**.

**`NET::ERR_CERT_AUTHORITY_INVALID` / “TRAEFIK DEFAULT CERT” in Chrome:** Traefik only serves your PEMs when **`02-default-tls.yml`** is loaded and **`cert.pem`** + **`key.pem`** are valid (full chain + matching key). If Chrome shows **TRAEFIK DEFAULT CERT**, the dynamic TLS file was missing, paths were wrong, or PEMs failed to parse — **not** because **`STAR_*.crt`** sat unused beside **`cert.pem`**. Merge **`STAR_*.crt`** + **`.ca-bundle`** → **`cert.pem`**, copy the matching private key → **`key.pem`**, then recreate Traefik. If **`ensure-traefik-ssl.sh`** created **`CN=edgecontrol-traefik-local`**, replace that **`cert.pem`**. Verify: `openssl s_client -connect <host>:443 -servername edgecontrol.ptsi.co.id </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer`.

**ACME HTTP-01 still fails:** check **DNS → this host**, **:80** reachable, and that nothing **in front** of Traefik answers **`/.well-known/acme-challenge/`** with **404**. This stack’s Traefik does **not** load Docker labels; if you run **another** Traefik on the same IP with **`@docker`** routers for the same **`Host()`**, fix that instance’s labels or consolidate to one edge proxy.

**If ACME fails with no obvious TLS error:** Let’s Encrypt needs a **router on this Traefik** for the public **`Host()`** so HTTP-01 is answered on **:80**. After removing **`providers.docker`**, old log lines such as **`routerName=…@docker`** refer to **another** Traefik or **historical** state — this project’s routes come from the **file** provider only and appear as **`@file`** in Traefik’s own logs.

**Checks (this stack):**

1. **Static config** — **`./docker/traefik/traefik.yml`** must contain **`providers.file.directory: /etc/traefik/dynamic.d`** and **`watch: true`** (already the default in this repo). The directory inside the container must match the Compose bind mount: **`./docker/traefik/dynamic.d:/etc/traefik/dynamic.d`** (a typo such as **`dynamicc.d`** breaks loading).
2. **File provider started** — `docker logs edgecontrol-traefik 2>&1 | grep -i file` should show the file provider starting (exact wording varies by Traefik version).
3. **Dynamic files present** — `docker exec edgecontrol-traefik ls -la /etc/traefik/dynamic.d` — expect **`00-static.yml`**, committed **`02-default-tls.yml`**, and **`01-managed.yml`** after **Regenerate** when you use managed routes.
4. **Managed content visible** — `docker exec edgecontrol-traefik cat /etc/traefik/dynamic.d/01-managed.yml` — confirm YAML for your domains exists on the **same** host where Traefik runs.
5. **Restart** — `docker compose up -d --force-recreate traefik` after changing static paths or mounts.

**`01-managed.yml` is generated:** the API overwrites **`docker/traefik/dynamic.d/01-managed.yml`** on **Regenerate** and on managed-service changes — do not rely on hand-edits there; change data in the UI or adjust **`TraefikService.buildConfig()`** in the repo.

**Traefik v3.6 + HTTP-01:** Traefik answers **`/.well-known/acme-challenge/*`** on **`web`** via its **internal** handler when something still requests ACME (e.g. resolver registered from Compose). Do **not** add a manual **`PathPrefix`** router to **`noop@internal`**. **`00-static.yml`** uses **`priority: 1`** on **`web`** redirect routers only; **`websecure`** panel/MinIO routers use **`tls: {}`** (default PEM store) and **`priority: 10000`** so internal ACME (~**23**) does not win and return Traefik’s **404**. **`01-managed.yml`** mirrors that pattern from **`TraefikService`**. Re-run **`./scripts/render-traefik-static.sh`**, **Regenerate** managed routes, then recreate **`traefik`** after pulling.

### Host checkout path (Linux)

On servers it is common to keep the clone under **`/opt/stack`** or **`/opt/apps`**, for example:

- `/opt/stack/edgecontrol` (or `/opt/stack/<repo-name>`)
- `/opt/apps/edgecontrol` (or `/opt/apps/<repo-name>`)

Use the same base path in Compose **volume mounts**, Traefik file-provider paths, backup jobs, and **systemd** `WorkingDirectory` / `ExecStart` so services resolve `./docker/...` and `.env` consistently.

### Topology: single host vs split VPS

The Compose file runs the **edge**, **app**, and **observability** roles on one machine for development. In production you may split them (public Traefik only, private app, private Prometheus/Grafana on a management network).

| Concern | All-in-one Compose | Split (e.g. three VPS) |
|--------|----------------------|-------------------------|
| Panel / API vs managed edge | **Loopback** and/or **Traefik :443** — panel + MinIO in **`00-static.yml`**; extra hosts in **`01-managed.yml`**; default TLS in **`02-default-tls.yml`** + **`ssl/`**; API internal (**nginx** → **`http://api:3000`**). | Same ideas; split Traefik to its own host if you prefer. |
| Prometheus scrape target | `api:3000` in [docker/prometheus/prometheus.yml](docker/prometheus/prometheus.yml) resolves on the Compose network. | Point `static_configs.targets` at the **app host’s private address** (and open the scrape path only between observability and app). |
| Grafana → Prometheus | `http://prometheus:9090` in provisioning. | Same hostname if both run in one observability stack; otherwise use the private Prometheus URL. |
| Host ports **9090** / **3010** | Published for local access; convenient for laptops. | Prefer binding to a **private interface**, removing public mappings, or firewall rules so Prometheus and Grafana are not exposed on the internet. |

Traefik load balancer health checks and the worker use each service’s **`healthPath`** (default **`/`** for broad reachability; set e.g. **`/api/health`** when your app exposes that). **`01-managed.yml`** is created only when the API has at least one managed route (it is **not** committed; an empty **`{}`** file would break Traefik’s merge with **`00-static.yml`**).

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
  traefik/      # traefik.yml + dynamic.d/ (02-default-tls + ssl cert.pem/key.pem) + ssl/ on disk
  prometheus/   # Prometheus scrape config
  grafana/      # Grafana provisioning + dashboards
scripts/
  setup.sh      # Bootstrap (.env, secrets, network) + deploy: full, compose, db, db reset, seed, reset, apps, clean
```

## Licensing

Private / internal — adjust when you publish or open-source the project.
