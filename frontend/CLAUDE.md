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
├── planner/                  # Projects: page.tsx = project cards, [id]/ = project board/list, report/ = progress & status
├── english/                  # English for IT course (page.tsx), placement test, lesson/[id] (theory · vocab · practice / quick check · listening = `listening.tsx`: sentence-by-sentence TTS player, questions, AI-graded summary), journal, review (weak points from your mistakes → focus page + auto-graded tests via `review/runner.tsx`, which reuses the lesson `ExerciseView`; saved words tested as multiple choice)
│                             # english/games: hub + "Nối từ" (games/sentence: tap shuffled words into a sentence; data.ts = 6 worlds × 22 sentences with traps/alts, engine.ts = levels/tokenizing/checking) + "Ghép cặp" (games/match: pair matching); shared localStorage progress in games/progress.ts
├── diary/, tech-notes/       # thin pages over components/notebook/Notebook.tsx: split Markdown editor | live preview (full height), History dialog (by day, search, edit, delete), draft in localStorage; each has its own API store (api.diary / api.techNotes)
├── chat/page.tsx             # RAG chat UI
├── design/page.tsx           # living style guide (tokens + components)
├── components/               # AppShell (sidebar, ⌘K), ui.tsx primitives, icons, KnowledgeForm, TaskRow…
└── lib/api.ts                # typed API client + shared types
```

The planner pages poll `api.tasks.day()` while any task still has
`coachStatus === 'PENDING'` — tasks are saved before the AI finishes correcting their
English — and stop polling once everything has settled.

`/planner` is now **Projects** (nav group "Projects": List + Report). Personal-only: the Work area,
categories, goals, notes, stats and the planner's own sidebar are gone from the UI (tables still exist).
A project (`planner_project`: name + description) owns its tasks via `planner_task.projectId`.
`/planner/[id]` wraps the board/list in `PlannerProvider` (`planner/state.tsx`): every mutation goes
through `run()`, which bumps `rev` so views re-fetch; it polls `meta.englishPending` while background
English fixes run. Project status (not started / in progress / stalled = 14 days idle / done) and the
8-week trend are computed in `PlannerService.listProjects()`. Types in `lib/planner.ts`, HTTP in `api.planner`.

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
