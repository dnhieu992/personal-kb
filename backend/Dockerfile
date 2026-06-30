# syntax=docker/dockerfile:1

# ---- build stage: compile TypeScript → dist/ ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: prod deps + compiled output only ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# The embedding model downloads to ./.cache on first use; mount a volume here
# (see docker-compose.prod.yml) so it survives container restarts.
EXPOSE 4001
CMD ["node", "dist/main.js"]
