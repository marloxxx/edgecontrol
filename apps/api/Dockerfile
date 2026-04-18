# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/trpc/package.json ./packages/trpc/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages ./packages

RUN pnpm --filter @edgecontrol/db exec prisma generate
RUN pnpm --filter @edgecontrol/api build

# Stage 2: Runner
# pnpm keeps many deps only under apps/api/node_modules (symlinks into root .pnpm).
# Copy the same layout as the builder so Node can resolve workspace + hoisted packages.
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/api
EXPOSE 3000
# tsc emits ESM specifiers like `./app.module` which Node refuses to load; tsx matches `pnpm dev`.
CMD ["./node_modules/.bin/tsx", "src/main.ts"]
