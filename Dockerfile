# Codalla — single-container image: Express serves both the API and the
# built frontend (see artifacts/api-server/src/app.ts). Designed for Cloud
# Run; see PLAN.md → "Deploy to Google Cloud".

FROM node:24-slim AS build
RUN npm install -g pnpm@10
# Install Python and build essentials for native modules (better-sqlite3)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/codalla run build \
 && pnpm --filter @workspace/api-server run build \
 && cp -r artifacts/codalla/dist/public artifacts/api-server/dist/public

FROM node:24-slim
# git powers repo cloning and the editor's git features
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/artifacts/api-server/dist ./dist
ENV NODE_ENV=production
# Cloud Run injects PORT; 8080 is its default
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]

