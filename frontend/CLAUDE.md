# Frontend (Next.js) — Claude Code guide

Next.js 14 App Router, TypeScript, Tailwind CSS. Run from this directory. Dev server on
**:4000**.

## Layout

```
app/
├── page.tsx                  # dashboard (stats + recent)
├── layout.tsx, globals.css   # shell + Tailwind
├── knowledge/                # list, new, [id]/edit pages
├── chat/page.tsx             # RAG chat UI
├── components/               # shared UI (e.g. KnowledgeForm)
└── lib/api.ts                # typed API client + shared types
```

## API access (important)

All backend calls go through `app/lib/api.ts`. It picks the base URL by environment:

- **Browser** → `NEXT_PUBLIC_API_URL` (`/api-proxy`), which `next.config.js` rewrites to the
  backend. Same-origin, so no CORS.
- **Server / RSC** → `API_INTERNAL_URL` (`http://localhost:4001`) directly.

When adding an endpoint, extend the `api` object in `app/lib/api.ts` rather than calling
`fetch` from components — keep types and the proxy behavior in one place.

## Conventions

- App Router with Server Components by default; add `'use client'` only when needed
  (forms, chat, interactivity).
- Tailwind utility classes; type→color map lives in `app/lib/api.ts` (`TYPE_COLORS`).
- The `KnowledgeType` union mirrors the backend enum — keep both in sync.

## Commands

```bash
npm run dev     # :4000
npm run build
npm run lint
```
