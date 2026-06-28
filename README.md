# Personal Knowledge Base

A self-hosted knowledge base with semantic search and an AI chat assistant.

- **Frontend:** Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Backend:** NestJS (TypeScript, TypeORM)
- **Database:** MySQL 8
- **Vector DB:** Qdrant (via Docker)
- **AI:** Claude API (`claude-haiku-4-5`) via the official `@anthropic-ai/sdk`
- **Embeddings:** `@xenova/transformers` running `all-MiniLM-L6-v2` locally (384-dim)

> **Note on embeddings:** Anthropic's Claude API does **not** provide an embeddings
> endpoint. Embeddings are generated locally with the open-source
> `@xenova/transformers` library (no API key, no extra cost). Claude is used for
> tag extraction, summarisation, code-snippet extraction, and RAG answer synthesis.

> **Note on the model:** the brief asked for `claude-haiku-3-5`, but that model is
> retired and now returns 404. This project uses the current Haiku, `claude-haiku-4-5`.

## Structure

```
personal-kb/
├── frontend/          # Next.js app  (http://localhost:3000)
├── backend/           # NestJS app   (http://localhost:3001, Swagger at /api/docs)
├── docker-compose.yml # MySQL 8 + Qdrant
└── README.md
```

## Prerequisites

- Docker + Docker Compose
- Node.js 20+
- An Anthropic API key

## 1. Start infrastructure (MySQL + Qdrant)

```bash
docker compose up -d
```

MySQL → `localhost:3306`, Qdrant → `localhost:6333`.

## 2. Backend

```bash
cd backend
cp .env.example .env          # then set ANTHROPIC_API_KEY
npm install
npm run seed                  # inserts 5 sample entries + embeds them
npm run start:dev             # http://localhost:3001  (Swagger: /api/docs)
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

`frontend/.env.local` already points `NEXT_PUBLIC_API_URL` at `http://localhost:3001`.

## One-shot start (after the first install)

From the repo root:

```bash
docker compose up -d
(cd backend && npm run start:dev) &
(cd frontend && npm run dev) &
```

## API overview

| Method | Path                         | Description                              |
|--------|------------------------------|------------------------------------------|
| POST   | `/knowledge`                 | Create (auto tags/summary/snippets + embed) |
| GET    | `/knowledge`                 | List (filter `?type=` & `?tag=`)         |
| GET    | `/knowledge/search?q=`       | Semantic search via Qdrant               |
| GET    | `/knowledge/stats`           | Dashboard stats                          |
| GET    | `/knowledge/:id`             | Get one                                  |
| PUT    | `/knowledge/:id`             | Update (re-embed)                        |
| DELETE | `/knowledge/:id`             | Delete (+ remove from Qdrant)            |
| POST   | `/ai/suggest-tags`           | Suggest tags from pasted content         |
| POST   | `/ai/chat`                   | Natural-language RAG chat over the KB    |

`type` enum: `BUG_FIX | HOW_TO | ARCHITECTURE | INSIGHT | DAILY_LOG`
