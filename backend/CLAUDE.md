# Backend (NestJS) — Claude Code guide

NestJS + TypeORM API for the knowledge base. Entry point `src/main.ts`, root module
`src/app.module.ts`. Run from this directory.

## Modules

| Module | Path | Responsibility |
|--------|------|----------------|
| `knowledge` | `src/knowledge/` | CRUD over the `Knowledge` entity (MySQL). Controller → service → TypeORM repo. On create/update it calls `ai` to enrich and `embedding` to (re)index. |
| `embedding` | `src/embedding/` | Generates 384-dim vectors locally with `@xenova/transformers` and upserts/searches/deletes them in Qdrant (collection `knowledge`). No external API. |
| `ai` | `src/ai/` | Wraps `@anthropic-ai/sdk` (`claude-haiku-4-5`) for tag/summary/snippet extraction and RAG chat. Disabled-but-safe when `ANTHROPIC_API_KEY` is unset (returns fallbacks). |

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

- `synchronize: true` auto-creates/updates the MySQL schema from entities in dev.
- Editing the `KnowledgeType` enum here? Mirror it in `frontend/app/lib/api.ts`.
- Embedding model lazy-loads on first use and caches to `.cache/` (gitignored).
