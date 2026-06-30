# syntax=docker/dockerfile:1

# ---- build stage: next build (standalone output) ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Next.js evaluates rewrites() at BUILD time, so the /api-proxy → backend
# destination is baked in now. In the compose network the backend is reachable
# as the "backend" service. Override with --build-arg if your service name differs.
ARG API_INTERNAL_URL=http://backend:4001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build

# ---- runtime stage: minimal standalone server ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# Standalone bundle ships its own minimal node_modules + server.js.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 4000
CMD ["node", "server.js"]
