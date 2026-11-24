# Backend (NestJS) — Claude Code guide

NestJS + TypeORM API for the knowledge base. Entry point `src/main.ts`, root module
`src/app.module.ts`. Run from this directory.

## Modules

| Module | Path | Responsibility |
|--------|------|----------------|
| `knowledge` | `src/knowledge/` | CRUD over the `Knowledge` entity (MySQL). Controller → service → TypeORM repo. On create/update it calls `ai` to enrich and `embedding` to (re)index. |
| `embedding` | `src/embedding/` | Generates 384-dim vectors locally with `@xenova/transformers` and upserts/searches/deletes them in Qdrant (collection `knowledge`). No external API. |
| `ai` | `src/ai/` | Calls Claude through **headless Claude Code** (`ClaudeCodeService`, Agent SDK, claude.ai subscription — no API key; `claude-haiku-4-5`) for tag/summary/snippet extraction, entry reformat-and-translate-to-English (`formatContent`), English coaching (`reviewEnglishUsage`) and RAG chat. Disabled-but-safe when there is no login (`CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`, or `~/.claude/.credentials.json`) (returns fallbacks; ask `isEnabled()`). |
| `english` | `src/english/` | Shared English coaching (`EnglishCoachService`): asks the AI what to revise, files the answer as review cards linked to a `sourceId`, dedupes them, and deletes them with their source. No controller — `knowledge` and `task` both use it, which is what keeps the review queue identical for entries and tasks. |
| `task` | `src/task/` | The planner: `Task` (day plan, status, priority, COMPANY/PERSONAL, backlog) and `TaskList` (long-term todo lists). Saves are instant; the English pass runs in the background. |
| `course` | `src/course/` | "English for IT" course at `/english` (tables `course_unit`, `course_lesson`, `course_attempt`): CEFR levels A2–C1 → 12 units × 5 lessons + a unit review each (`course.types.ts` `UNITS_PER_LEVEL`/`LESSONS_PER_UNIT`; older smaller levels are topped up with extra units on the next generate run). Learner goal in `course_goal` (single row: start/target level, lessons per week) → `GET /course/journey` (% over the whole path, pace, streak, ETA; unwritten levels count at planned size). Content is AI-written **once and stored** (`CourseGeneratorService`, background, resumable); lessons unlock in order when the previous one's practice scores ≥ 70%; first pass files the lesson's vocab as review cards via `EnglishCoachService.collect`. Built on a reference syllabus (`syllabus.ts`: British Council – EAQUALS Core Inventory points per level) and a placement test (`placement-bank.ts`, `course_placement`) that sets the default level and marks lessons mastered/weak. |
| `diary` | `src/diary/` | Plain personal diary (`/diary`, table `diary_entry`): Markdown content + `createdAt` (when written), CRUD, newest first. No AI. Stamps are set in the service, not by MySQL defaults (VPS MySQL is +07, the container reads DATETIME as UTC). |
| `tech-note` | `src/tech-note/` | Technical notes (`/tech-notes`, table `tech_note`): same shape as `diary`, deliberately a separate module/table so it can grow on its own. `POST /tech-notes/english/check` proofreads a draft (Sonnet via `EnglishCheckService`; code/links/images swapped for ⟦n⟧ placeholders so they come back untouched) → changes + suggested cards; `POST /tech-notes/english/cards` files the chosen ones through `EnglishCoachService.collect` (sourceId = note id, or `tech-notes` for an unsaved draft). |
| `planner` | `src/planner/` | Web port of the "Planner" Mac app (`/planner/*`, tables `planner_*`, independent of `task`): Work/Personal areas, categories, todo tasks (backlog/today/week/month, Kanban), checklist, links, recurrence, goals, notes + day notes, stats, English auto-correct log. Reminders go to Telegram (cron every minute). |

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
- **Planner** (`src/planner/`): ids are ints, day keys are `YYYY-MM-DD` varchar, "today" is
  computed in `PLANNER_TZ` (default `Asia/Ho_Chi_Minh`). No TypeORM relations — the service
  does cascades itself. Recurring tasks are materialized lazily per day (`ensureRecurring`,
  unique `(recurrenceId, date)` + INSERT IGNORE); a deleted occurrence stays as a `hidden`
  row so it isn't regenerated. Title/checklist/goal/note-title fixes run in the background
  via `AiService.correctEnglish` and are logged in `planner_correction` (revertable).
- **Course** (`src/course/`): `POST /course/levels/:level/generate` writes the outline (if the
  level has none) then every PENDING/FAILED lesson, 3 at a time, with `CourseAiService`
  (`src/ai/course-ai.service.ts`, `claude-opus-5-5` or `COURSE_MODEL`, structured JSON output,
  ~1 min per lesson, billed to the Claude subscription). Exercises are normalised/dropped by `normaliseExercise` so every
  one is gradable; grading happens in the browser (`frontend/app/lib/course.ts`) and the run's
  score is posted to `/course/lessons/:id/attempts`. Progress lives on `course_lesson`
  (single learner). Lessons stuck GENERATING after a restart are reset to PENDING on boot.
- **Skill exercises**: besides mcq/gap/order/match/fix, lessons have `listen` (browser TTS of
  `passage`; dictation or choice), `read` (passage + question) and `write` (AI-graded via
  `POST /course/lessons/:id/grade`, Haiku). Lessons with `skillsVersion < SKILLS_VERSION` get these
  appended by the next generate run (`CourseAiService.generateSkills`), and their unit review is redrawn.
- **Listening tasks** (`ListeningService`, table `course_listening`, one per taught lesson): a spoken passage
  (browser TTS, text hidden) + MCQ questions + key ideas. Written by `CourseAiService.generateListening` on first
  open (`POST /course/lessons/:id/listening/generate`, background, ~1 min; GENERATING rows → FAILED on boot). Length
  grows with the lesson's place in the level (`listeningTarget`: A2 100–180 → C1 380–500 words). The learner's
  English summary is graded by `gradeSummary` (Sonnet) per key idea (covered 1 / partial ½ / missing 0) →
  `POST .../listening/grade`; ≥ `LISTENING_PASS_SCORE` (60%) passes. Independent of the lesson's pass mark.
- **Review on mistakes** (`CourseReviewService`, table `course_exercise_stat`, one row per lesson ×
  exercise index): every practice answer (sent with its `index`; unit-review answers are mapped back to
  the lesson they were copied from) updates seen/wrong/streak. Wrong → due now; then right answers push
  it 1 / 3 / 7 days; 3 right in a row resolves it. `GET /course/review/weak` groups by syllabus key
  (weakest first, placement weak points included), `/review/points/:key` = the lessons' "Lỗi hay gặp"
  section + your wrong answers + a 10-item test, `/review/daily` = due mistakes + fresh items on weak
  points (studied lessons only), `POST /review/results` records a test. First boot replays past full
  lesson runs (in order, no index) into the table.
- **Unit reviews**: `course_lesson.kind = REVIEW`, built by `CourseGeneratorService.buildReview`
  (no AI) from the harder exercises of the unit's lessons once they are all READY (also on boot);
  pass mark `REVIEW_PASS_SCORE` (80%).
- **Syllabus & placement**: lessons carry `syllabusKeys` (Core Inventory keys from `course/syllabus.ts`;
  the outline prompt must cover every key of the level). The placement test is static (`placement-bank.ts`,
  our own items — never paste exam content), graded server-side, 12 items per level, stops after a block
  < 50%, places at the first level < 75%. Right answers → `mastered` keys (lesson doesn't block the path,
  passable by a 6-question quick check ≥ 80%, `quick: true` on the attempt); wrong answers at or below the
  placed level → `weak` keys (lesson unlocked and recommended first). `CourseSyllabusService` maps lessons
  written before this (by grammar label) and adds the B1 "Sprint Retrospectives" unit on boot — idempotent.
- **Claude Code, not the API**: `ClaudeCodeService.ask()` spawns one headless Claude Code process per call
  (built-in tools, settings, MCP all off; API-key env vars stripped). Expect ~5 s of overhead per call.
  Login: `CLAUDE_CODE_OAUTH_TOKEN` in `/opt/personal-kb/backend.env` (made with `claude setup-token`,
  valid ~1 year). The native binary comes from the SDK's per-platform optional dependency, so keep
  `@anthropic-ai/claude-agent-sdk-linux-x64` in the lockfile.
- Embedding model lazy-loads on first use and caches to `.cache/` (gitignored).
