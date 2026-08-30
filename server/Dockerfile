FROM node:20-alpine

WORKDIR /app

# Install deps first so this layer is cached unless package.json changes
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000

# Migrations run automatically on boot (src/index.js -> runMigrations()),
# so there's nothing extra to do here at container start.
CMD ["node", "src/index.js"]
