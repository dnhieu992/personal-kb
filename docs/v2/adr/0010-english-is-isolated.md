# ADR 0010 — English and Diary are isolated modules

**Status:** accepted (Phase 2)

## Context
v1 stored English review cards as rows of `knowledge` (type ENGLISH) with a `sourceId` pointing at entries or
tasks, and the knowledge/task services called the English coach directly. English could not be lifted out, and
deleting a task silently deleted cards.

## Decision
- `isolated/english` owns `english_*` tables and `/api/english/*`; `isolated/diary` owns `diary_entry`.
  They import only `platform/` (enforced by dependency-cruiser).
- No foreign key from `english_*`/`diary_*` into core tables (asserted by an integration test). Where a card was
  met is kept as text (`source`) plus an in-app link (`source_url`).
- Core editors talk to English one way, over HTTP: `POST /english/check` (proofread, nothing stored) and
  `POST /english/mistakes` (accepted fixes + chosen cards → review queue). Repeating a mistake from another source
  flips the existing card to `hard` instead of duplicating it.
- Inline images for journal/diary go through `platform/storage` (`/api/uploads/images`), not a module of either.
- The ported pages keep v1's response shapes (`LegacyEnglishItem`) so the UI port changed storage, not screens.

## Consequences
Removing English = delete `isolated/english`, `apps/web/src/app/(app)/english`, `features/english` and the
`english_*` tables; core keeps working (the Check English button would 404). Deleting a note/task no longer
deletes cards learned from it — intentional: the card is still worth reviewing.
