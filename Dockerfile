# syntax=docker/dockerfile:1

# Neylon AI — production image for VPS/EC2 (and local Docker Compose).
# Switch Postgres/Redis between local containers and cloud via env only.

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
RUN apk add --no-cache libc6-compat

# ─── Prune monorepo to the `web` workspace + deps ─────────────────────────────
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.5.4 prune web --docker

# ─── Install + build ──────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# NEXT_PUBLIC_* are inlined at build time; empty = same-origin (fine for Docker/Vercel).
# Placeholders satisfy any remaining eager env reads during `next build` page collection.
# Real DATABASE_URL / REDIS_URL are injected at container runtime via compose env_file.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DATABASE_SSL=false
ENV REDIS_URL=redis://127.0.0.1:6379
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV GOOGLE_API_KEY=build-time-placeholder-not-used-at-runtime
ENV GOOGLE_API_KEYS=build-time-placeholder-not-used-at-runtime
ENV AGENT_MODEL_LOW=gemini-3.1-flash-lite
ENV AGENT_MODEL_MEDIUM=gemini-3.5-flash
ENV AGENT_MODEL_HIGH=gemini-3.6-flash
ENV AGENT_MODEL=gemini-3.6-flash
ENV ROUTER_CLASSIFIER_MODEL=gemini-3.1-flash-lite
ENV UTILITY_MODEL=gemini-3.5-flash-lite
ENV EMBEDDING_MODEL=gemini-embedding-001
RUN pnpm turbo run build --filter=web

# ─── Slim runtime (Next.js standalone) ────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
