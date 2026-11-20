# syntax=docker/dockerfile:1

# ---------- Stage 1: production dependencies only ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: minimal runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations

# The official image ships a non-root "node" user (uid 1000).
USER node
EXPOSE 4000

# Liveness only (the process answers). DB readiness is /api/ready, used by
# the Kubernetes readinessProbe.
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations run on boot (src/index.js -> runMigrations(), guarded by a
# Postgres advisory lock so several replicas can start together).
# Exec form => node is PID 1 and receives SIGTERM directly (graceful shutdown).
CMD ["node", "src/index.js"]
