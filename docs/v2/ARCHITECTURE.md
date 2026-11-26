# personal-kb v2 — Architecture

> Trạng thái: **đề xuất** (2026-11-26), dựa trên [SPEC.md](./SPEC.md) + đánh giá code bản cũ.
> Mục tiêu kép: **dùng hằng ngày** và **học architecture**. Vì vậy mỗi quyết định ghi rõ *tại sao*
> và *học được gì*. Quyết định lớn nên được tách thành ADR trong `docs/adr/` (mục 11).

---

## 1. Đánh giá source code bản cũ

Số liệu đo trực tiếp trên `new-account/personal-kb` (commit `78ed324`, ~25.9k LOC TS).

### 1.1 Vấn đề cấu trúc

| # | Vấn đề | Bằng chứng | Hậu quả |
|---|---|---|---|
| A1 | **Dependency vòng giữa module** | `ai → course, knowledge` và `course → ai`, `knowledge → ai`; `english ↔ knowledge` | Không module nào tách riêng được; sửa prompt AI phải hiểu domain course/knowledge |
| A2 | **Module thò tay vào bảng của module khác** | `EnglishCoachService` inject repo `Knowledge`, `Task`, `TechNote`; `AiController` inject repo `Knowledge` | Đổi schema 1 bảng → vỡ 3 module. Đây là lý do English "dính" khắp nơi |
| A3 | **God service** | `planner.service.ts` 1142 LOC, 10 repository, gom project/category/task/checklist/attachment/recurrence/goal/note/stats/English correction | Không test được, mỗi tính năng mới phình thêm |
| A4 | **AI service biết domain** | `ai.service.ts` 453 LOC + `course-ai.service.ts` 518 LOC chứa prompt của mọi module | Hạ tầng (gọi Claude) và nghiệp vụ (prompt) trộn lẫn → gây ra A1 |
| A5 | **Background work fire-and-forget trong RAM** | `autoCheck(...).then(...)`, `pendingEnglish = new Set()` | Restart là mất việc; không retry; fan-out không kiểm soát → OOM giết MySQL (commit `ca80064`) |
| A6 | **Khái niệm trùng lặp** | 2 hệ task, 3 khái niệm project, `knowledge` vừa note vừa flashcard | Đã ghi trong SPEC §1 |
| A7 | **Schema không có version** | `synchronize: true` ở prod, 0 migration | Đổi entity có thể xóa cột/dữ liệu khi deploy |
| A8 | **Không có test** | 0 file `*.spec.ts` | Không dám refactor → càng code càng rối |

### 1.2 Vấn đề frontend

| # | Vấn đề | Bằng chứng |
|---|---|---|
| F1 | API client khổng lồ + type khai báo lại | `lib/api.ts` 1171 LOC; enum `knowledge.type` duplicate BE/FE |
| F2 | Server state quản lý tay | 363 chỗ `useState/useEffect`, không có cache layer → refetch thủ công, state lệch giữa trang |
| F3 | 2 đường gọi API | Browser → `/api-proxy`, RSC → `API_INTERNAL_URL` (gotcha trong CLAUDE.md) |
| F4 | State nhân đôi | `localStorage` ở 5 file, merge với DB (games) |

### 1.3 Vấn đề bảo mật / vận hành (ưu tiên sửa ngay ở bản cũ)

| # | Vấn đề | Mức |
|---|---|---|
| S1 | Không auth + backend `network_mode: host` bind `0.0.0.0:4001` | **Cao** — ai biết IP là đọc/xóa được dữ liệu, gọi AI tốn quota |
| S2 | **Qdrant publish `6333:6333`** ra mọi interface, không API key | **Cao** — chưa có trong TODO cũ |
| S3 | `enableCors({ origin: true, credentials: true })` | Trung bình (sẽ thành cao khi có cookie auth) |
| S4 | Swagger `/api/docs` public | Thấp–TB: lộ toàn bộ API surface |
| S5 | Không backup DB | Trung bình — app "dùng thật" mà mất dữ liệu là mất hết |

→ Việc mở trong SPEC §12 ("kiểm tra firewall 4000/4001") cần **thêm 6333**.

### 1.4 Đáng giữ lại

- `ClaudeCodeService`: hàng đợi FIFO giới hạn concurrency, degrade khi không có login, env sạch → thành lõi của `AiGateway`.
- `planner-dates.ts`, `quick-entry.ts`: hàm thuần, đã tách khỏi Nest → mang sang domain layer, viết test.
- Same-origin proxy (không CORS), CI/CD GHCR + self-hosted runner, `mem_limit`.

**Kết luận:** gốc rễ không phải "code xấu" mà là **không có ranh giới được cưỡng chế** (A1, A2, A4) và
**không có test** (A8). v2 tập trung vào đúng 2 điểm đó; mọi thứ khác là hệ quả.

---

## 2. Nguyên tắc kiến trúc

1. **Modular monolith** — 1 process API, 1 DB, nhưng module có ranh giới như service riêng.
   *Tại sao:* 1 user, 4GB RAM; microservices chỉ thêm network + deploy. *Học:* cách vẽ ranh giới — kỹ năng khó nhất và dùng lại được khi tách service thật.
2. **Ranh giới được máy kiểm tra**, không dựa vào kỷ luật — lint rule fail CI nếu import sai (§3.3).
3. **Mỗi bảng có đúng một module chủ.** Module khác muốn dữ liệu → gọi public API của module đó, không inject repository.
4. **Domain logic là hàm thuần** — không Nest, không TypeORM, không `new Date()` → unit test trong mili-giây.
5. **Invariant quan trọng giữ ở DB** (unique, FK), không chỉ ở code.
6. **Việc nền phải bền** — ghi vào bảng job trong cùng transaction, worker xử lý, có retry. Không `.then()` trôi nổi.
7. **Một nguồn sự thật cho type** — schema zod dùng chung FE/BE.
8. **Đơn giản trước** — mỗi thư viện/khái niệm mới phải trả lời được "bản cũ đau ở đâu mà cần cái này".

---

## 3. Cấu trúc repo & module

### 3.1 Monorepo (pnpm workspaces)

```
personal-kb-v2/
├── apps/
│   ├── api/                  NestJS 10 + TypeORM
│   └── web/                  Next.js (App Router) + Tailwind + TanStack Query
├── packages/
│   └── contracts/            zod schema + type suy ra + hằng số enum (FE & BE import)
├── docs/                     SPEC.md, ARCHITECTURE.md, adr/
├── docker-compose.yml        dev: MySQL + Qdrant
├── docker-compose.prod.yml
└── .github/workflows/
```

*Tại sao pnpm workspace:* `packages/contracts` cần được cả 2 app import mà không publish npm. *Học:* monorepo tooling, TS project references.

### 3.2 Module backend

```
apps/api/src/
├── main.ts
├── app.module.ts
├── platform/                 hạ tầng dùng chung — KHÔNG chứa nghiệp vụ
│   ├── config/               env đọc qua zod, sai là không boot (fail fast)
│   ├── database/             DataSource, migrations/, base entity (uuid, timestamps)
│   ├── auth/                 login, session cookie, global guard, @Public()
│   ├── clock/                Clock service (today theo APP_TZ) — inject để test được
│   ├── ai/                   AiGateway: ask(prompt, schema) + hàng đợi + log. Không có prompt nghiệp vụ
│   ├── storage/              StoragePort + R2Adapter (presign PUT/GET, delete)
│   ├── jobs/                 bảng job + worker + đăng ký handler
│   └── health/
├── core/                     domain chính — trục task
│   ├── project/
│   ├── task/                 task, checklist, recurrence, today, kanban
│   ├── note/                 note, tag, attachment
│   └── search/               gom kết quả từ task + note
└── isolated/                 module cách ly — chỉ được phụ thuộc platform/
    ├── english/              course, review, phrase, game, listening, tts, check, telegram cron
    └── diary/
```

Mỗi module có cùng layout (học 1 lần, dùng mọi nơi):

```
core/task/
├── task.module.ts
├── index.ts                  PUBLIC API — thứ duy nhất module khác được import
├── http/                     controller: parse request (zod) → gọi use case → map response
├── application/              use case / service: transaction, gọi repository, phát job
├── domain/                   hàm thuần: recurrence.ts, today.ts, task-rules.ts  ← unit test
└── infra/                    entity TypeORM, repository, query FULLTEXT
```

> Không áp dụng full hexagonal cho mọi module — `diary` chỉ là CRUD, để `http/ + infra/` là đủ.
> Layer chỉ thêm khi có logic thật để bảo vệ. Đó cũng là một bài học.

### 3.3 Quy tắc phụ thuộc (cưỡng chế bằng `dependency-cruiser` trong CI)

```
            ┌────────────── platform ──────────────┐
            ▲            ▲            ▲            ▲
            │            │            │            │
   project ◀── task ◀── note      english       diary
      ▲         ▲        ▲
      └──── search ──────┘
```

| Rule | Ý nghĩa |
|---|---|
| `platform/*` không import `core/*`, `isolated/*` | Hạ tầng không biết nghiệp vụ (sửa A4) |
| `isolated/*` chỉ import `platform/*` + `contracts` | English/Diary bê ra app riêng được (SPEC §7.1) |
| `core/X` chỉ import `core/Y/index.ts`, không vào `infra/`, `domain/` của Y | Không inject repo của module khác (sửa A2) |
| Không có vòng | `dependency-cruiser --validate` fail nếu có (sửa A1) |
| `domain/` không import `@nestjs/*`, `typeorm` | Giữ domain thuần |

### 3.4 AI: tách "gọi model" khỏi "prompt"

```
platform/ai/AiGateway                  core/note/application/note-ai.prompts.ts
  ask<T>({purpose, system, user,       isolated/english/check/check.prompts.ts
         schema, effort, timeout})     isolated/english/course/course.prompts.ts
  - hàng đợi (concurrency = 2)            │
  - timeout, retry 1 lần                  └── mỗi module tự giữ prompt + zod schema
  - degrade khi không có login                 của mình, gọi AiGateway.ask()
  - ghi ai_call (purpose, ms, status)
```

Đây là thay đổi then chốt phá vòng `ai ↔ course ↔ knowledge`. `ai_call` log giúp trả lời "AI nào chạy nhiều/chậm/hay lỗi" — bản cũ không biết.

---

## 4. Data model (core)

Mọi bảng: `id CHAR(36)` UUID v7 (sort được theo thời gian, index tốt hơn v4), `created_at`, `updated_at`.

```
project 1───* task 1───* checklist_item
   │            │  *
   │            │  └──1 task_recurrence (template)
   │            │
   │ 0..1       │ 0..1
   └──* note *──┘
         │
         ├──* note_tag *──1 tag
         └──* attachment
```

| Bảng | Cột chính | Ràng buộc / index |
|---|---|---|
| `project` | name, color, archived_at | unique(name) |
| `task` | project_id, title, description (md), status `todo/doing/done`, priority `TINYINT 0–3`, due_date `DATE`, pinned_for `DATE`, position `VARCHAR` (kanban), recurrence_id, completed_at | FK project RESTRICT · idx(status, due_date) · FULLTEXT(title, description) |
| `checklist_item` | task_id, title, done, position | FK task CASCADE |
| `task_recurrence` | project_id, title, description, priority, rule `JSON`, anchor_date, status `active/paused/ended`, checklist_template `JSON` | |
| `note` | title, content (md), project_id NULL, task_id NULL | FK SET NULL cả hai · FULLTEXT(title, content) |
| `tag`, `note_tag` | name | unique(name), PK(note_id, tag_id) |
| `attachment` | note_id, r2_key, filename, mime, size, status `pending/ready` | FK note CASCADE · FULLTEXT(filename) |
| `job` | type, payload JSON, status, run_at, attempts, locked_until, last_error | idx(status, run_at) |
| `ai_call` | module, purpose, model, duration_ms, status, error | idx(created_at) |

### 4.1 Các quyết định đáng học

- **"Chỉ một instance đang mở" giữ ở DB**: cột sinh `open_slot = IF(status <> 'done', recurrence_id, NULL)` + `UNIQUE(open_slot)`. MySQL cho nhiều NULL trong unique → task thường không bị ảnh hưởng; 2 instance mở của cùng chuỗi sẽ vi phạm unique dù code có bug hay double-click.
  *Lưu ý MySQL:* cột gốc của generated column không được có FK `SET NULL/CASCADE` → FK `recurrence_id` dùng `RESTRICT` (chuỗi lặp được *end*, không xóa).
- **Note gắn task XOR project**: muốn dùng `CHECK`, nhưng MySQL cấm CHECK trên cột có FK action `SET NULL`. → Giữ invariant ở domain (`note-rules.ts`) + test. Ví dụ thật về việc "DB không làm được thì code làm".
- **`due_date`, `pinned_for` là `DATE`, không phải `DATETIME`**: đây là "ngày theo lịch của tôi", không phải thời điểm. "Hôm nay" chỉ tính ở một chỗ: `Clock.today()` theo `APP_TZ=Asia/Ho_Chi_Minh`.
- **Auto-unpin không cần cron**: Today chỉ lấy `pinned_for = today`. Sang ngày mới, ghim cũ tự hết hiệu lực. *Học:* derive thay vì mutate — bớt một job, bớt một nguồn lỗi.
- **Kanban `position` là fractional index** (chuỗi, lib `fractional-indexing`): kéo thả chỉ update 1 dòng, không đánh số lại cả cột.
- **Recurrence = hàm thuần**: `nextDue(rule, anchor, previousDue): DateKey` trong `domain/recurrence.ts`. "Theo lịch, không theo ngày hoàn thành" → input là `previousDue`, không phải `completedAt`. Đây là chỗ viết test nhiều nhất (cuối tháng, 31→30, tháng 2, mỗi N ngày, weekday).
- **Hoàn thành instance lặp** trong 1 transaction: set done → tính `nextDue` → insert instance mới + copy checklist template (reset). Unique `open_slot` bảo vệ race.

### 4.2 English & Diary

Chỉ đổi tên/di chuyển, không thiết kế lại: `english_*` (`english_card` tách khỏi note, `english_phrase`, `english_course_*`, `english_game_progress`, `english_correction`), `diary_entry`. Không có FK nào trỏ sang bảng core.

---

## 5. API contract

- REST, prefix `/api`, JSON, camelCase. Request/response định nghĩa bằng zod trong `packages/contracts`:

```ts
// packages/contracts/src/task.ts
export const TaskStatus = z.enum(['todo', 'doing', 'done']);
export const CreateTaskInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300),
  priority: z.number().int().min(0).max(3).default(1),
  dueDate: DateKey.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;
```

  Backend: `ZodValidationPipe(CreateTaskInput)`. Frontend: dùng cùng type cho client + form. Thêm enum ở 1 chỗ, compiler báo mọi chỗ cần sửa (sửa F1).
- Lỗi theo **RFC 7807** `{ type, title, status, detail, errors? }` qua 1 global exception filter.
- List dùng **cursor pagination** (`?cursor=&limit=`), cursor = `(sortKey, id)`.

| Module | Endpoint chính |
|---|---|
| auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| project | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id`, `GET /projects/:id/overview` |
| task | `GET /tasks?projectId&status&cursor`, `POST /tasks`, `PATCH /tasks/:id`, `POST /tasks/:id/move` (status + position), `POST /tasks/:id/complete`, `DELETE /tasks/:id` |
| checklist | `POST /tasks/:id/checklist`, `PATCH/DELETE /checklist/:id` |
| recurrence | `POST /recurrences`, `PATCH /recurrences/:id` (rule, pause, end) |
| today | `GET /today` → `{ overdue[], dueToday[], inProgress[], pinned[] }` |
| note | `GET /notes?projectId&taskId&tag&cursor`, `POST /notes`, `GET/PATCH/DELETE /notes/:id`, `GET /tags` |
| attachment | `POST /notes/:id/attachments` → presigned PUT · `POST /attachments/:id/confirm` · `GET /attachments/:id/url` → presigned GET |
| search | `GET /search?q&projectId&tag` |
| english | `/english/*` (port), gồm `POST /english/check`, `POST /english/mistakes` |
| diary | `/diary/*` (port) |
| health | `GET /health` (public, ping DB) |

**Upload R2 (3 bước, file không đi qua API → không tốn RAM):**
browser xin presigned PUT → upload thẳng lên R2 → gọi `confirm` (API `HEAD` object kiểm size/mime, set `ready`). Job dọn `pending` quá 24h + xóa object khi attachment/note bị xóa.

---

## 6. Việc nền: job queue trên MySQL

Không thêm Redis (RAM). Bảng `job` + worker chạy trong process API:

```
Use case ──(cùng transaction)──▶ INSERT job       ← transactional outbox
                                     │
Worker (poll 2s) ── SELECT ... FOR UPDATE SKIP LOCKED LIMIT n
   │   set locked_until, attempts++
   ├─ ok   → status=done
   └─ lỗi  → run_at = now + backoff(attempts), quá max → status=dead
```

- Concurrency giới hạn theo loại job (job gọi AI dùng chung hàng đợi của `AiGateway`) → không bao giờ lặp lại sự cố OOM.
- Handler phải **idempotent** (job có thể chạy lại).
- Job dự kiến: `attachment.cleanup`, `english.phrase.telegram` (cron enqueue), phase 3: `note.embed`, `attachment.extract-text`.
- *Học:* outbox pattern, at-least-once delivery, `SKIP LOCKED`, backoff, dead letter — những thứ hay gặp khi phỏng vấn system design, ở đây tự build được trong ~150 LOC.

---

## 7. Auth & bảo mật

- **Single-user:** `AUTH_PASSWORD_HASH` (argon2) trong env. `POST /auth/login` → cookie `httpOnly; Secure; SameSite=Lax`, giá trị ký bằng `SESSION_SECRET` (chứa `exp`), không cần bảng session.
- **Global guard** (`APP_GUARD`) chặn mọi route; mở bằng decorator `@Public()` cho `/health`, `/auth/login`. Mặc định là đóng — quên decorator thì bị chặn chứ không bị lộ.
- Rate limit `/auth/login` (`@nestjs/throttler`).
- API bind `127.0.0.1:4201`; chỉ web `4200` public. Không bật CORS (same-origin qua proxy). Swagger chỉ bật khi `NODE_ENV !== 'production'`.
- Qdrant (phase 3) bind `127.0.0.1` + API key.
- Next `middleware.ts`: không có cookie → redirect `/login` (chỉ là UX; guard ở API mới là bảo vệ thật).

---

## 8. Frontend

```
apps/web/src/
├── app/
│   ├── login/page.tsx
│   ├── (app)/layout.tsx          shell: sidebar, command palette
│   ├── (app)/today/page.tsx      route mỏng: chỉ ghép feature components
│   ├── (app)/projects/[id]/...
│   ├── (app)/notes/...
│   ├── (app)/english/...
│   └── api/[...path]/route.ts    proxy → API 127.0.0.1:4201, chuyển cookie
├── features/
│   ├── tasks/   { api.ts, queries.ts, components/ }
│   ├── notes/   { ... }
│   ├── projects/
│   ├── search/
│   ├── english/ { ..., public.ts }   ← core chỉ import CheckEnglishButton từ đây
│   └── diary/
└── shared/      { http.ts, ui/, markdown/, editor/ }
```

- **TanStack Query** cho mọi server state: cache, invalidate theo key, **optimistic update** khi kéo kanban/tick checklist (rollback nếu lỗi). Thay 363 `useState/useEffect` tự viết (sửa F2). *Học:* server state ≠ client state.
- **Chỉ fetch phía client qua 1 đường** `/api/*` (sửa F3). Server Components chỉ dùng cho layout tĩnh. App 1 user không cần SSR data; bỏ được cả gotcha `API_INTERNAL_URL`.
- `shared/http.ts`: fetch wrapper ~50 LOC (base URL, parse RFC 7807, 401 → `/login`). Mỗi feature có `api.ts` riêng dùng type từ `contracts`.
- Không `localStorage` cho dữ liệu (chỉ cho UI pref như theme) (sửa F4).
- **Editor dùng chung** `shared/editor/MarkdownEditor` có slot `toolbarExtras` — core truyền `<CheckEnglishButton>` vào; editor không biết English tồn tại.

---

## 9. Deploy & vận hành

```
VPS (4GB, chung với market-analysis + tet-flights)
├── host MySQL 127.0.0.1:3306   DB personal_kb_v2
├── web  container  :4200 (public)
├── api  container  network_mode: host, HOST=127.0.0.1 PORT=4201, mem_limit 1200m
└── qdrant (phase 3) 127.0.0.1:6333
```

- **CI** (GitHub-hosted): `pnpm install` → typecheck → lint → `depcruise --validate` → unit + integration test → build image → push GHCR.
- **CD** (self-hosted runner): pull → `docker compose run --rm api node dist/migrate.js` → `up -d`. Migration là bước riêng, chạy trước khi app mới nhận request; lỗi migration thì dừng deploy, app cũ vẫn chạy.
- **Log**: `nestjs-pino`, JSON, có `requestId`; log mỗi job & AI call với thời gian.
- **Backup**: job hằng đêm `mysqldump personal_kb_v2 | gzip` → R2 (bucket riêng), giữ 14 bản. Thử restore 1 lần sau khi setup — backup chưa từng restore = chưa có backup.

---

## 10. Testing

| Tầng | Công cụ | Test gì |
|---|---|---|
| Unit | Vitest | `domain/*`: recurrence, today classification, quick-entry, note rules. Nhanh, nhiều |
| Integration | Vitest + Testcontainers (MySQL 8) | use case + repository + migration thật: complete recurring trong transaction, unique `open_slot`, FULLTEXT search, job `SKIP LOCKED` |
| E2E | Playwright (vài flow) | login → tạo task → hoàn thành task lặp → thấy instance mới ở Today |

Không đặt % coverage. Quy tắc: **mỗi bug sửa xong phải có test tái hiện nó.**

---

## 11. Lộ trình học gắn với Phase

ADR (`docs/adr/NNNN-title.md`: bối cảnh, lựa chọn, quyết định, hệ quả) — viết trước khi code phần tương ứng.

| Bước | Xây | Khái niệm học | ADR |
|---|---|---|---|
| 1.1 | Monorepo, contracts, config zod, migrations, health, CI | monorepo, schema-first, migration | 0001 modular monolith · 0002 zod contracts · 0003 migrations |
| 1.2 | Auth + guard + proxy | session cookie, default-deny | 0004 single-user auth |
| 1.3 | Project + Task CRUD + Today | layering, Clock injection, unit test | 0005 date vs datetime |
| 1.4 | Recurrence + checklist | domain thuần, invariant ở DB, transaction | 0006 one-open-instance |
| 1.5 | Kanban + TanStack Query | optimistic update, fractional index | |
| 1.6 | Note + tag + attachment R2 | ports & adapters, presigned URL | 0007 direct-to-R2 upload |
| 1.7 | Job queue + search FULLTEXT + dependency-cruiser | outbox, SKIP LOCKED, module boundary | 0008 MySQL job queue |
| 1.8 | Migration script dữ liệu lõi + deploy song song | ETL idempotent, chạy lại được | |
| 2 | Port English/Diary, Check English, Telegram cron | tách module cách ly, AiGateway + prompt theo module | 0009 English isolation |
| 3 | Embedding nền, RAG, trích text | job pipeline, vector search | |

Mỗi bước kết thúc khi: chạy được trên VPS + có test cho domain logic + ADR (nếu có) đã viết.

---

## 12. Việc mở

- [ ] **Ngay ở bản cũ:** chặn 4001 **và 6333** bằng firewall (hoặc đổi Qdrant sang `127.0.0.1:6333:6333`).
- [ ] Xóa task có note gắn vào: note **tách ra** (FK SET NULL, đang đề xuất) hay xóa theo?
- [ ] Xóa project: chặn khi còn task (đề xuất, FK RESTRICT) hay archive?
- [ ] Testcontainers cần Docker trên máy dev + CI runner — xác nhận chấp nhận (thay thế: DB test trong docker-compose).
