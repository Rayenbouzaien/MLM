# syntax=docker/dockerfile:1

# ---------- Stage 1: build the static bundle ----------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.3 --activate

# Dependency layer: cached unless package.json / pnpm-lock.yaml change.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# VITE_API_URL is intentionally NOT set: the browser calls /api on its own
# origin and nginx forwards it to the api service (see nginx.conf).
RUN pnpm build

# ---------- Stage 2: tiny runtime image (nginx, no Node, no sources) ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Unprivileged image: runs as user "nginx" (uid 101) and listens on 8080.
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
