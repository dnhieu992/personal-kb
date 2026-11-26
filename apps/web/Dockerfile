# Build context: repo root (monorepo). docker build -f apps/web/Dockerfile .
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @pkb/web...
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN pnpm --filter @pkb/contracts build && pnpm --filter @pkb/web build

FROM node:20-alpine
ENV NODE_ENV=production PORT=4200 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 4200
CMD ["node", "apps/web/server.js"]
