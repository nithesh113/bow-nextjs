# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────
# BOW Next.js — production Docker image
# Multi-stage build so the final image contains only the runtime bits.
# Works identically on Docker Desktop (Windows) and any Linux VPS.
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: install + build ────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install OS deps that Next.js / Prisma need at build time
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy manifests first so Docker caches the install layer when only code changes
COPY package.json package-lock.json* ./
COPY scripts ./scripts
COPY prisma ./prisma

# Install ALL deps (dev included) — needed for `next build` and `prisma generate`
# Must use NODE_ENV=production so:
#   1. npm ci installs devDependencies (needed for tooling, but skipped under default prod)
#   2. The build workers don't trip a non-standard NODE_ENV warning that
#      breaks prerender of internal error pages (Next 16 + Turbopack quirk)
ENV NODE_ENV=production
RUN npm ci --include=dev --no-audit --no-fund

# Copy the actual source code
COPY . .

# Generate Prisma client + run the production build
# Realpath patch is needed because Prisma + npm symlinks fail fs.promises.realpath
# on Windows + Docker bind-mount paths.
RUN unset NODE_ENV && export NODE_ENV=production && \
    node --require ./scripts/node-realpath-patch.cjs ./node_modules/prisma/build/index.js generate && \
    NEXT_TELEMETRY_DISABLED=1 npm run build

# ── Stage 2: minimal runtime image ─────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Same OS deps at runtime (Prisma needs openssl + ca-certs for Postgres TLS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user — security best practice
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Copy *only* what we need to run
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Generated Prisma client lives in node_modules — already covered above.
# But the engine binary needs to be reachable; copy explicitly to be safe.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

# Healthcheck — useful for VPS deployments + docker compose
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Use direct `next` invocation instead of `npm start` to skip npm log writes
# (npm tries to create /home/nextjs/.npm/_logs which fails for the non-root user)
CMD ["node", "./node_modules/next/dist/bin/next", "start"]
