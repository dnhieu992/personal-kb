# Frontend (Next.js) — Claude Code guide

Next.js 14 App Router, TypeScript, Tailwind CSS. Run from this directory. Dev server on
**:4000**.

## Layout

```
app/
├── page.tsx                  # dashboard (stats + recent)
├── layout.tsx, globals.css   # shell + Tailwind
├── knowledge/                # list, new, [id]/edit pages
├── plan/                     # daily planner + plan/lists (long-term todo lists)
├── planner/                  # web port of the Planner Mac app (full-width client app)
├── english/                  # English for IT course (page.tsx), placement test, lesson/[id] (theory · vocab · practice / quick check), journal, review queue
├── diary/                    # personal diary: split Markdown editor | live preview (full height), History dialog (by day, search, edit, delete); draft kept in localStorage
├── chat/page.tsx             # RAG chat UI
├── design/page.tsx           # living style guide (tokens + components)
├── components/               # AppShell (sidebar, ⌘K), ui.tsx primitives, icons, KnowledgeForm, TaskRow…
└── lib/api.ts                # typed API client + shared types
```

The planner pages poll `api.tasks.day()` while any task still has
`coachStatus === 'PENDING'` — tasks are saved before the AI finishes correcting their
English — and stop polling once everything has settled.

`/planner` is one client page (`planner/page.tsx`) with its own context (`planner/state.tsx`):
every mutation goes through `run()`, which bumps `rev` so all views re-fetch; it polls
`meta.englishPending` while background English fixes are running. Types/date helpers are in
`lib/planner.ts`, HTTP calls in `api.planner`. `components/AppShell.tsx` gives `/planner` the full
width and folds the global sidebar to a rail there.

## Design system

Read `DESIGN.md` before touching UI. Use semantic tokens (`bg-surface`, `text-fg-muted`,
`bg-accent`…) and the `.btn` / `.input` / `.card` / `.chip tone-*` classes — never raw palette
classes like `bg-slate-100`, which break dark mode. Pages start with `<PageHeader>`; navigation
lives in `components/nav.ts` (sidebar + ⌘K).

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
- Tailwind with semantic tokens (see `DESIGN.md`); type→tone map lives in `app/lib/api.ts` (`TYPE_COLORS`).
- The `KnowledgeType` union mirrors the backend enum — keep both in sync.

## Commands

```bash
npm run dev     # :4000
npm run build
npm run lint
```
