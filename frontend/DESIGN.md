# Design system

The UI is built from a small set of **semantic tokens** and **component classes**. The living
reference is the `/design` page (rendered with the real classes); this file holds the rules.

## Information architecture

One sidebar, grouped by job (`app/components/nav.ts` — the sidebar and ⌘K both read it):

| Group     | Pages |
|-----------|-------|
| —         | Home (today across planner, English and knowledge) |
| Plan      | Planner · Daily plan · Lists |
| Knowledge | Entries · Projects · Ask AI |
| English   | Course · Placement test · Journal · Review · Games · Phrases |

- **Desktop:** 240px sidebar, collapsible to a 60px icon rail (remembered). App pages with their
  own sidebar (`/planner`) start as a rail.
- **Mobile:** top bar + drawer. No horizontal scrolling.
- **⌘K / Ctrl+K** palette everywhere: go to a page, create things, or semantic-search knowledge
  (`/knowledge?q=`). Page shortcuts: Planner `N` `/` `B` `Esc`; Review `Space` `1` `2`; lesson practice `Enter` (check / next), `1`–`4` (choice); Nối từ `1`–`9` (word) `⌫` `Esc` `Enter`; Ghép cặp `1`–`9` (left) `A`–`J` (right) `Esc`.

## Tokens (`app/globals.css` → `tailwind.config.ts`)

RGB channels on `:root`, redefined under `[data-theme="dark"]`. A script in `<head>` sets
`data-theme` before paint from `localStorage['kb.theme']` (system | light | dark).

| Kind | Classes |
|------|---------|
| Surfaces | `bg-canvas` (page) · `bg-surface` (cards, inputs) · `bg-subtle` (hover) · `bg-muted` (chips, tracks) · `bg-emphasis` |
| Lines | `border-line` (default for bare `border`) · `border-line-strong` (inputs) |
| Text | `text-fg` · `text-fg-secondary` · `text-fg-muted` · `text-fg-subtle` · `text-fg-faint` |
| Accent | `bg-accent` `hover:bg-accent-hover` `text-accent-fg` · `bg-accent-soft` · `text-accent-text` |
| Status | `danger` / `success` / `warning` / `info`, each with `-soft` and `-text` |

**Rule:** never use raw palette classes (`bg-slate-100`, `text-indigo-600`) in pages — they don't
follow dark mode. Data colors the user picks (planner categories, areas) stay inline styles.

## Components

- **Buttons:** `.btn` + one of `btn-primary | btn-secondary | btn-ghost | btn-soft | btn-danger |
  btn-danger-ghost`, optional `btn-lg | btn-sm | btn-xs`, `btn-icon` for square. One primary per view.
- **Inputs:** `.input` (+ `input-sm`) for input/select/textarea; `.label` above, `.hint` below.
- **Containers:** `.card`, `.card-interactive` (hover lift), `.popover`, `.menu-item`.
- **Chips:** `.chip` + `.tone-{gray,accent,red,orange,amber,green,teal,sky,blue,violet,pink}`.
  Tones live outside `@layer` so `tone-${x}` built at runtime is never purged.
- **Text:** `.eyebrow`, `.section-title`, `.link`, `.kbd`, `.prose-kb` (rendered Markdown).
- **React** (`app/components/ui.tsx`, server-safe): `PageHeader`, `Section`, `StatCard`,
  `EmptyState`, `Alert`, `Loading`, `ProgressBar`, `cx`. Icons: `<Icon name>` from
  `components/icons.tsx` (24px grid, 1.75 stroke). Emoji only inside user content.

## Type, shape, depth

Inter for UI, JetBrains Mono for code/editors (`next/font`). Page title 22/32 semibold, section
15 semibold, body 13.5, meta 12, eyebrow 11 uppercase. Radius: 6px chips · 8px controls · 12px
cards. Shadows `xs` (resting) → `sm` (hover) → `md` (sticky) → `lg` (floating).

## Page recipe

```tsx
<PageHeader title="Entries" description="One line on what this page is for." actions={<Link className="btn btn-primary">…</Link>} />
{loading ? <Loading /> : error ? <Alert>{error}</Alert> : items.length === 0 ? <EmptyState … /> : <grid of .card>}
```
