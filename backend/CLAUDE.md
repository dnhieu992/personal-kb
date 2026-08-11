# Backend (NestJS) — Claude Code guide

NestJS + TypeORM API for the knowledge base. Entry point `src/main.ts`, root module
`src/app.module.ts`. Run from this directory.

## Modules

| Module | Path | Responsibility |
|--------|------|----------------|
| `knowledge` | `src/knowledge/` | CRUD over the `Knowledge` entity (MySQL). Controller → service → TypeORM repo. On create/update it calls `ai` to enrich and `embedding` to (re)index. |
| `embedding` | `src/embedding/` | Generates 384-dim vectors locally with `@xenova/transformers` and upserts/searches/deletes them in Qdrant (collection `knowledge`). No external API. |
| `ai` | `src/ai/` | Wraps `@anthropic-ai/sdk` (`claude-haiku-4-5`) for tag/summary/snippet extraction, entry reformat-and-translate-to-English (`formatContent`), English coaching (`reviewEnglishUsage`) and RAG chat. Disabled-but-safe when `ANTHROPIC_API_KEY` is unset (returns fallbacks; ask `isEnabled()`). |
| `english` | `src/english/` | Shared English coaching (`EnglishCoachService`): asks the AI what to revise, files the answer as review cards linked to a `sourceId`, dedupes them, and deletes them with their source. No controller — `knowledge` and `task` both use it, which is what keeps the review queue identical for entries and tasks. |
| `task` | `src/task/` | The planner: `Task` (day plan, status, priority, COMPANY/PERSONAL, backlog) and `TaskList` (long-term todo lists). Saves are instant; the English pass runs in the background. |

## Conventions

- Standard Nest layout: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/`.
- DTOs use `class-validator`; a global `ValidationPipe({ whitelist: true, transform: true })`
  is set in `main.ts`, so add validation decorators rather than manual checks.
- Endpoints are documented with `@nestjs/swagger` decorators → Swagger UI at `/api/docs`.
  Add `@ApiProperty` / `@ApiTags` when you add fields or routes.
- Config via `ConfigService` (env), never `process.env` directly in services.

## Commands

```bash
npm run start:dev   # watch, :4001
npm run seed        # 5 sample entries + embeddings (needs DB + Qdrant up)
npm run build       # → dist/
```

## Gotchas

- Saving a non-ENGLISH entry makes **two** Claude calls in parallel (`formatContent`
  translates the body to English; `reviewEnglishUsage` mines the raw text for grammar and
  vocabulary to revise), then a third for `enrich`. Budget ~6–8s per save.
- Items collected by `reviewEnglishUsage` are stored as ENGLISH rows with `sourceId` set to
  the entry **or task** they came from, `projectId: null`. They are deduped by `content`: a
  repeat from another source flips the existing card's `hard` flag instead of creating a
  second card. All of this lives in `EnglishCoachService` — don't re-implement it per feature.
- Tasks are coached **in the background**: `POST /tasks` returns before the AI has run, with
  `coachStatus: PENDING`. `originalTitle`/`originalNotes` are stamped with the text as typed
  up front, and the pass bails if they no longer match (the row was edited or deleted meanwhile).
  Clients poll `coachStatus` until it leaves `PENDING`.
- Both task entities reference each other, so their enums live in `entities/task-enums.ts`.
  A `@Column({ enum })` reading an enum across that import cycle resolves to `undefined` at
  runtime and crashes on boot.
- `synchronize: true` auto-creates/updates the MySQL schema from entities in dev.
- Editing the `KnowledgeType` enum here? Mirror it in `frontend/app/lib/api.ts`.
- Embedding model lazy-loads on first use and caches to `.cache/` (gitignored).
