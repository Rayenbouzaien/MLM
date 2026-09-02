FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.3 --activate

# Installed separately from the rest of the source so this layer is
# cached unless package.json / pnpm-lock.yaml actually change.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# vite.config.ts already binds 0.0.0.0 and reads PORT (defaults to 8443),
# so no extra flags are needed here — this matches how it already runs
# inside Figma Make's own containerized preview.
EXPOSE 8443
RUN pnpm build
CMD ["pnpm", "preview"]
