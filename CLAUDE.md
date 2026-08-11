# Personal Knowledge Base — Claude Code guide

Self-hosted knowledge base with semantic search + an AI chat assistant (RAG).
Monorepo: a NestJS API and a Next.js web app, backed by MySQL and Qdrant.

## Architecture (how a request flows)

```
Browser ──/api-proxy/*──▶ Next.js (web :4000) ──proxy──▶ NestJS (api :4001)
                                                              │
                          ┌───────────────────────────────────┼──────────────┐
                          ▼                                   ▼              ▼
                   MySQL (knowledge)                 Qdrant (vectors)   Claude API
                   structured rows                   384-dim search     enrich + RAG
```

- **Frontend** (`frontend/`): Next.js 14 App Router, TypeScript, Tailwind. Talks to the
  API through a same-origin proxy so there are no CORS issues and only the web port
  needs to be public. See `frontend/CLAUDE.md`.
- **Backend** (`backend/`): NestJS + TypeORM. Feature modules — `knowledge` (CRUD),
  `task` (daily plan + long-term todo lists), `english` (shared coaching), `embedding`
  (local vectors + Qdrant), `ai` (Claude enrichment + RAG chat). See `backend/CLAUDE.md`.
- **Embeddings are local**, not from Claude. The Claude API has no embeddings endpoint, so
  vectors come from `@xenova/transformers` (`all-MiniLM-L6-v2`, 384-dim) running on-device.
  Claude is used only for tag/summary/snippet extraction and RAG answer synthesis
  (`claude-haiku-4-5`).

## Ports (authoritative — from code/env, the README is stale)

| Service  | Port | Notes |
|----------|------|-------|
| Frontend | 4000 | `next dev -p 4000` |
| Backend  | 4001 | `PORT` in `backend/.env`; Swagger at `/api/docs` |
| MySQL    | 3307 → 3306 | Docker maps host **3307** to avoid clashing with a host MySQL on 3306 |
| Qdrant   | 6333 (REST), 6334 (gRPC) | |

> The repo runs alongside another project (`market-analysis`) on the same host, which is
> why ports are shifted off the defaults. Keep this in mind before changing them.

## Common commands

```bash
# Infra (MySQL + Qdrant)
docker compose up -d
docker compose down

# Backend (from backend/)
npm install
npm run seed          # insert 5 sample entries + embed them
npm run start:dev     # watch mode, http://localhost:4001
npm run build         # nest build → dist/

# Frontend (from frontend/)
npm install
npm run dev           # http://localhost:4000
npm run build
npm run lint

# One-shot from repo root (after first install)
docker compose up -d
(cd backend && npm run start:dev) &
(cd frontend && npm run dev) &
```

## Conventions

- **The knowledge base is English-only.** Saving a non-ENGLISH entry runs the body and
  title through Claude: reformat to Markdown **and translate to English**, whatever
  language it was typed in. What the author typed is kept in `knowledge.originalContent`
  (null when the AI changed nothing). Send `autoFormat: false` to store text verbatim.
- **Entries double as English practice.** The same save collects the grammar the author
  got wrong and the words they didn't know into ENGLISH review items (`sourceId` = the
  entry), so they show up in `/english/review`. Deleting the entry deletes them.
- **Tasks get the same treatment.** `/plan` is a daily planner (status, priority,
  COMPANY/PERSONAL, backlog, carry-over) with long-term lists at `/plan/lists`. Titles and
  notes are corrected into English and mined for review cards exactly like entries — but
  **in the background**, so adding a task is instant. Send `autoCoach: false` to skip it.
- **TypeScript everywhere.** Match existing style; no new lint config.
- **Secrets stay out of git.** `backend/.env` and `frontend/.env.local` are gitignored;
  only `*.env.example` is committed. Never print or commit real keys.
- **DB schema is auto-synced in dev** (`synchronize: true` in `app.module.ts`). Fine for
  vibe coding; switch to migrations before any real production use.
- **The `knowledge.type` enum** (`BUG_FIX | HOW_TO | ARCHITECTURE | INSIGHT | DAILY_LOG`)
  is duplicated in `backend/.../knowledge.entity.ts` and `frontend/app/lib/api.ts` —
  keep them in sync when adding a type.

## Gotchas

- AI features **degrade gracefully** without `ANTHROPIC_API_KEY` (return fallbacks), so the
  app boots without a key — but tag suggestions / chat won't be useful.
- First embedding call **downloads the model** to a local cache (`.cache/`, gitignored).
- The frontend reaches the API two ways: browser → `/api-proxy` (proxied), server/RSC →
  `API_INTERNAL_URL` directly. Both are wired in `frontend/app/lib/api.ts`.

## Git

- Default branch is **`master`**.
- Remote: `git@github.com:dnhieu992/personal-kb.git`.
