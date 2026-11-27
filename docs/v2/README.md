# personal-kb v2 — status & runbook

Spec: [SPEC.md](./SPEC.md) · Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md) · Decisions: [adr/](./adr)

v2 lives in this repo beside v1 (ADR 0001). v1 (`backend/`, `frontend/`) keeps running untouched until cut-over.

## Status

| Phase | Item | State |
|---|---|---|
| 1 | Monorepo, contracts (zod), config (fail-fast), migrations, health, RFC 7807 errors | ✅ |
| 1 | Auth (single user, signed cookie, global guard, login rate limit), same-origin proxy | ✅ |
| 1 | Projects (+ archive), Tasks, checklist, kanban (fractional positions), Today | ✅ |
| 1 | Recurring tasks (daily / weekdays / monthly / every N days, pause/end/resume, skip) | ✅ |
| 1 | Notes (task XOR project XOR none), tags, attachments (R2 / local, presigned) | ✅ |
| 1 | MySQL job queue (outbox, SKIP LOCKED), keyword search (FULLTEXT) | ✅ |
| 1 | Module-boundary lint (dependency-cruiser), unit tests for domain | ✅ |
| 1 | ETL v1 → v2 for core data (`migrate:v1`, idempotent) | ✅ |
| 1 | Dockerfiles, `docker-compose.v2.prod.yml`, CI/CD `deploy-v2.yml` | ✅ (not yet run on the VPS) |
| 1 | Nightly DB backup → R2 (separate bucket, keep 14, restore drill done locally) | ✅ |
| 1 | Integration tests on real MySQL 8 (open_slot, CHECK, FK, FULLTEXT, SKIP LOCKED) — `pnpm --filter @pkb/api test:int`, in CI | ✅ |
| 1 | Playwright e2e | ⏳ (UI checked by hand in Chrome) |
| 2 | English module (course, placement, lessons, listening, review, journal, cards, phrases + Telegram cron, games, TTS) — `isolated/english` | ✅ |
| 2 | Diary — `isolated/diary` | ✅ |
| 2 | Check English (⌘/Ctrl+Shift+E) in note body, task title/description, checklist → `POST /english/mistakes` | ✅ |
| 2 | English + diary ETL in `migrate-v1` (journal, cards, course_*, phrases, games, corrections, diary) | ✅ |
| 2 | One design system (v1 semantic tokens + dark mode) across core and English | ✅ |
| 2 | Cut-over | ⏳ (needs a VPS run) |
| 3 | AI note tools: Suggest tags / Summarize / Rewrite (on click, proposals only) | ✅ |
| 3 | Attachment text extraction (PDF / docx / plain) → FULLTEXT + embeddings (job) | ✅ |
| 3 | Semantic search (MiniLM + Qdrant, background `note.embed`) + Ask (RAG with sources) | ✅ (off unless `QDRANT_URL`) |

## Local dev (Node 20, pnpm 10)

```bash
nvm use                                   # .nvmrc → 20
docker compose -f docker-compose.v2.yml up -d   # MySQL 8 on 127.0.0.1:3308, Qdrant on 127.0.0.1:6343 (key dev-qdrant-key)
pnpm install
cp apps/api/.env.example apps/api/.env    # then fill AUTH_PASSWORD_HASH + SESSION_SECRET:
pnpm --filter @pkb/contracts build && pnpm --filter @pkb/api build
node apps/api/dist/scripts/hash-password.js 'your password'
openssl rand -hex 32
cp apps/web/.env.example apps/web/.env.local
pnpm dev:api                              # http://127.0.0.1:4201/api (runs migrations when MIGRATE_ON_BOOT=true)
pnpm dev:web                              # http://localhost:4200
```

Checks (same as CI): `pnpm typecheck && pnpm depcruise && pnpm test`, plus
`IT_DATABASE_URL=mysql://root:root@127.0.0.1:3308 pnpm --filter @pkb/api test:int` (creates/drops its own DB).

AI features use headless Claude Code: log in once with `claude` (or set `CLAUDE_CODE_OAUTH_TOKEN`). Without it the
app runs; AI endpoints answer 503.

### Module map
- `core/` project · task · note (+ AI tools, indexing jobs) · search (keyword, semantic, ask) · overview
- `isolated/english` — tables `english_*`, routes `/api/english/*`; never touches core tables. Core editors reach it
  only over HTTP (Check English → `/english/check`, `/english/mistakes`); cards keep their source as text + link.
- `isolated/diary` — table `diary_entry`, routes `/api/diary`.
- `platform/` config · database · auth · http · jobs · storage (+ `/api/uploads/images`) · ai (gateway) · vector · backup

### Deliberate exceptions to "no localStorage for data"
Theme preference, and the diary's unsaved-draft buffer (protects typing against a refresh; it is never a copy of DB
rows). Game progress used to be doubled into localStorage (F4) — now server-only.

## First deploy on the VPS (done; was the parallel run on 4200/4201 — prod now uses 4000/4001)

1. Create DB + user on the host MySQL: `CREATE DATABASE personal_kb_v2; GRANT ALL ON personal_kb_v2.* TO 'pkb'@'localhost';`
2. Create a **private** R2 bucket for v2 + an API token; add a CORS rule: AllowedOrigins = the web origin, AllowedMethods = PUT, GET, AllowedHeaders = Content-Type.
3. `/opt/personal-kb-v2/api.env`: `DATABASE_URL`, `AUTH_PASSWORD_HASH`, `SESSION_SECRET`, `COOKIE_SECURE` (true only behind HTTPS), `STORAGE_DRIVER=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `V1_DATABASE_URL`,
   `BACKUP_BUCKET` (a second private bucket), `CLAUDE_CODE_OAUTH_TOKEN` (or rely on the mounted `/root/.claude`),
   `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`, and for semantic search `QDRANT_URL=http://127.0.0.1:6333` + `QDRANT_API_KEY`
   (shared Qdrant, new collection `pkb_v2_notes`; leave unset if RAM is tight — SPEC §10).
4. Merge to `master` → `deploy-v2.yml` builds, runs `node dist/migrate.js`, starts the stack.
5. Copy v1 data (core + English + diary): `docker compose -f docker-compose.v2.prod.yml run --rm --no-deps api node dist/scripts/migrate-v1.js --dry-run`, then without `--dry-run`. Re-run any time; it is idempotent.
   **Every v2 deploy re-runs it** (after `up -d`) while `V1_DATABASE_URL` is set in `api.env`; v1 stays the source of
   truth for rows that came from it, so edit those in v1 until cut-over. Remove `V1_DATABASE_URL` at cut-over.
6. With Qdrant on, index existing notes once: `docker compose -f docker-compose.v2.prod.yml run --rm --no-deps api node dist/scripts/reindex-notes.js`
   (the running API's worker embeds them in the background).

### Backups
Nightly at 03:30 (`BACKUP_CRON`, `APP_TZ`) and before every deploy's migration: `mysqldump | gzip` →
`BACKUP_BUCKET/backups/personal_kb_v2/<ISO time>.sql.gz`, newest 14 kept. Manual: `node dist/scripts/backup.js`.
**Restore drill** (into a scratch DB, never over prod): download a file, then
`gunzip -c <file>.sql.gz | mysql -u root -p personal_kb_v2_restore` and compare row counts.

### Still open from SPEC §12 / ARCHITECTURE §12
- v1 has **no auth** and binds `0.0.0.0:4001`; Qdrant publishes `6333`. Firewall both on the VPS now.
- v1 images stay as links to the old **public** bucket after ETL; copy them into the v2 bucket before deleting the old one.

## Cut-over (done 2026-11-27: final sync, V1_DATABASE_URL removed, v1 stopped, v2 moved to 4000/4001)
Run `migrate-v1` one last time → remove `V1_DATABASE_URL` from `api.env` → switch v2 to 4000/4001 → stop v1 → keep `personal_kb` one month → delete
`backend/`, `frontend/`, `deploy.yml`, `docker-compose.prod.yml`, `docker-compose.yml`.
