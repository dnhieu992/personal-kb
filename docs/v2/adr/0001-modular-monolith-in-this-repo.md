# 0001 — Modular monolith, built inside the v1 repo

**Context.** SPEC §10 planned a new `personal-kb-v2` repo. The owner prefers one repo.
**Decision.** v2 lives in this repo as a pnpm workspace (`apps/api`, `apps/web`, `packages/contracts`)
next to the untouched v1 (`backend/`, `frontend/`, npm). Each version has its own workflow, scoped by `paths`,
so pushing v2 code never redeploys v1 and vice versa. One NestJS process, one DB, modules with enforced
boundaries (`apps/api/.dependency-cruiser.cjs`, run in CI).
**Consequences.** Cut-over = delete `backend/`, `frontend/`, `deploy.yml`, `docker-compose.prod.yml`, swap ports.
