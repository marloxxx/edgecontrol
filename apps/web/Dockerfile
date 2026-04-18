# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/trpc/package.json ./packages/trpc/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages ./packages

# Optional: `docker compose build web --build-arg VITE_API_URL=…` when not using same-origin + nginx.
ARG VITE_API_URL
RUN set -e; \
    if [ -n "$VITE_API_URL" ]; then export VITE_API_URL="$VITE_API_URL"; fi; \
    pnpm --filter @edgecontrol/web build

# Stage 2: Serve
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
