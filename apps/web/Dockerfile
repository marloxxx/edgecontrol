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

# Same-origin `/trpc` + `/api` only (nginx proxies to `api:3000`). Clear any stray host env
# so `vite build` cannot embed an external API origin.
ENV VITE_API_URL=
RUN pnpm --filter @edgecontrol/web build

# Stage 2: Serve
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
