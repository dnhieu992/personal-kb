# personal-kb v2 — Product Spec

> Trạng thái: **đã chốt phần sản phẩm** (grill session 2026-11-25). Chưa code.
> Bước tiếp theo: phân tích architecture (module structure, data model chi tiết, API contract) trước khi bắt đầu Phase 1.

## 1. Bối cảnh

Bản cũ (`new-account/personal-kb`, ~25.8k LOC, NestJS + TypeORM + MySQL + Qdrant + Next.js 14) càng code càng rối. Nguyên nhân chính đo được trong code:

- **2 hệ thống task** song song: `task` (`/plan`, đã ẩn khỏi nav nhưng vẫn ship) và `planner`.
- **3 khái niệm project**: `project` (knowledge), `planner_project`, `task_list`.
- Bảng `knowledge` **gánh 2 việc**: note kinh nghiệm + flashcard tiếng Anh.
- Id lẫn lộn (UUID vs int), enum khai báo 2 lần (backend + `frontend/app/lib/api.ts`), file khổng lồ (`api.ts` 1171 LOC, `planner.service.ts` 1142 LOC), state vừa localStorage vừa DB, `synchronize: true` ở prod, không migration.
- **Không có auth**, backend bind `0.0.0.0:4001`.

v2 sửa bằng **luật cứng**: mỗi khái niệm chỉ tồn tại một lần, module có ranh giới rõ, không có gì phình ra ngoài mục tiêu.

## 2. Mục tiêu & phạm vi

**Một người dùng** (chính tôi). App là nơi:

1. Quản lý **task theo project** — đây là **trục chính**, mở app hằng ngày vì task.
2. Lưu **kinh nghiệm technical/business** dưới dạng note gắn vào task/project (hoặc đứng tự do) và **search lại** được.
3. **Học tiếng Anh IT** — module cách ly, nằm chung app chỉ vì tài nguyên VPS có hạn.
4. **Diary** cá nhân — module cách ly, bê nguyên như cũ.

**Ngoài phạm vi:** multi-user / phân quyền, goal, report, thông báo Telegram cho task, i18n, auto-AI chạy ngầm.

## 3. Domain lõi

### 3.1 Project
- **Một** khái niệm Project duy nhất, dùng chung cho task và note.
- Có trang tổng quan: danh sách task + note cấp project.

### 3.2 Task
| Trường | Ghi chú |
|---|---|
| title | bắt buộc |
| project | bắt buộc |
| status | `todo` / `doing` / `done` |
| priority | vd. low / medium / high / urgent |
| dueDate | tùy chọn |
| description | markdown |
| checklist | danh sách mục con có trạng thái done |
| pinnedForDate | ghim "làm hôm nay" (xem 3.5) |
| notes, attachments | qua Note (3.3) |

Views: **list theo project**, **kanban** (cột theo status), **Today** (3.5).

### 3.3 Note (= Knowledge Base)
- **Một loại Note duy nhất**: title + markdown + attachments + tags.
- Gắn vào **task**, hoặc **project**, hoặc **không gắn gì** (kinh nghiệm/research chung).
- Trang **KB** = tất cả note, lọc theo project / tag; search (mục 5).
- Trong task: hiện các note gắn vào task đó. Note là ghi chép thủ công — app **không** nhắc ghi.
- Không có form riêng theo loại; phân loại (bug-fix, architecture, decision, daily-log…) bằng **tag**.

### 3.4 Task lặp lại
- Kiểu lặp: hằng ngày · các thứ trong tuần (vd. T2/T4/T6) · hằng tháng (ngày cố định) · mỗi N ngày.
- Mỗi chuỗi lặp là một **template**; luôn chỉ có **một instance đang mở**.
- Khi instance được đánh dấu done → tạo instance kế tiếp, deadline tính **theo lịch** (không theo ngày hoàn thành).
- Instance mới: **copy checklist** (reset về chưa làm); **không copy** note/attachment (chúng thuộc lần làm cũ).
- Có thể **pause** hoặc **end** chuỗi.

### 3.5 Today view
Gom task từ **mọi project**, mỗi task có nhãn project, sort theo priority:
- **Overdue** — chưa done, quá deadline.
- **Due today** — deadline hôm nay (gồm instance lặp lại).
- **In progress** — status `doing`, kể cả không có deadline.
- **Pinned for today** — tự ghim; sang ngày mới tự bỏ ghim nếu chưa xong.

## 4. Attachments
- Lưu trên **Cloudflare R2**, bucket **private**.
- Xem/tải qua **presigned URL** ngắn hạn do backend cấp (kể cả ảnh nhúng trong markdown).
- Nhận **mọi loại file**, ≤ ~25MB/file (bản cũ chỉ nhận ảnh ≤5MB).
- Search v1: theo **tên file** + nội dung note chứa nó. Trích text PDF/docx → Phase 3.

## 5. Search
- **v1:** keyword search bằng **MySQL FULLTEXT** trên note (title, content, tags) + task (title, description), lọc project/tag.
- **Phase 3 (module tùy chọn):** semantic search + chat RAG, dùng lại pipeline Qdrant + MiniLM của bản cũ; embedding chạy **nền** (queue), không chặn lúc lưu.

## 6. AI
- Mọi lời gọi AI qua **một `AiService` chung** (Claude Agent SDK như bản cũ).
- **Lõi — chỉ chạy khi bấm**, không bao giờ tự sửa nội dung:
  - Note: *Suggest tags*, *Summarize*, *Rewrite concisely* (Phase 3).
  - **Check English** (Phase 2): có ở mọi editor (note, task title/description, checklist; **không** có ở diary). Phím tắt `Ctrl/⌘+Shift+E`. Kết quả dạng **diff** (sai đỏ / đúng xanh) + giải thích ngắn tiếng Việt; người dùng **Accept/Reject** từng chỗ. Không check tự động khi gõ.
  - Lỗi được Accept → gọi `POST /api/english/mistakes` để thành thẻ ôn tập (một chiều, qua API).
- **English module:** giữ toàn bộ tính năng AI như bản cũ.

## 7. Module cách ly

### 7.1 English
- Giữ **toàn bộ** như cũ: course có lộ trình, placement test, AI sinh bài, journal, review/flashcard SRS, phrases, games, listening/TTS.
- **Cách ly hoàn toàn:** bảng `english_*`, API `/api/english/*`, **không** đọc/ghi bảng task/note. Chỉ dùng chung auth, layout, `AiService`.
- Flashcard có bảng riêng (`english_card`), **không** nằm trong bảng note.
- Muốn liên kết "gặp từ này ở đâu" → lưu text/URL, không foreign key.
- **Telegram:** chỉ giữ cron gửi phrase, nằm gọn trong module English.
- Mục tiêu thiết kế: sau này bê module + bảng `english_*` ra app riêng mà không phải sửa lõi.

### 7.2 Diary
- Nhật ký cá nhân, **bê nguyên** như cũ, module riêng (bảng `diary_*`), không dính task/note.

### 7.3 Bỏ
- `tech-notes` (thay bằng Note), `/plan` + `task_list`, planner goal/report, `/design`.

## 8. Cross-cutting

- **Auth:** single-user — password hash trong env, session cookie httpOnly, **global guard** (trừ `/health`). Backend bind `127.0.0.1`, frontend gọi qua proxy. Không có bảng user.
- **UI:** toàn bộ tiếng **Anh** (cũng là môi trường luyện tiếng Anh). Nội dung note viết ngôn ngữ nào cũng được.
- **Quy ước code (luật cứng):**
  - TypeORM **migrations**, cấm `synchronize` ở prod.
  - Id **UUID** toàn bộ.
  - Mỗi entity một file.
  - Type/enum dùng chung FE/BE (một nguồn duy nhất).
  - API client tách theo module (hoặc generate), không có file `api.ts` khổng lồ.
  - State lưu ở DB; không nhân đôi vào localStorage.
- **Stack:** giữ NestJS 10 + TypeORM + MySQL 8 (host MySQL dùng chung) + Next.js (App Router, TS, Tailwind) + Qdrant (Phase 3).

## 9. Migration dữ liệu

Script **chạy một lần**, đọc DB cũ `personal_kb` → ghi DB mới `personal_kb_v2` (cùng host MySQL). Bản cũ chạy song song tới khi cut-over; chạy lại script lần cuối lúc cut-over.

Dữ liệu hiện có (đếm 2026-11-25):

| Nguồn | Số lượng | Đích |
|---|---|---|
| `knowledge` (non-English) | 8 | `note`; `type` cũ → tag; giữ project |
| `knowledge` (English: vocab/sentence/mistake/grammar/journal) | 61 | `english_card` (+ bảng English tương ứng) |
| `project` (knowledge) | 6 | `project` |
| `planner_project` | 2 | `project` |
| `planner_task` | 44 | `task` (int id → UUID) |
| `planner_checklist_item` | 93 | checklist của task |
| `phrase` | 415 | `english_phrase` |
| `course_*` | unit 11, lesson 24, exercise_stat 63, attempt 6 | `english_course_*` |
| `game_progress`, `planner_correction` | 2, 15 | bảng `english_*` tương ứng |
| Bảng trống (`task`, `task_list`, `diary_entry`, `tech_note`, planner goal/recurrence/note/attachment/category, course placement/listening/goal) | 0 | bỏ (diary giữ schema) |

Mapping project:
- **Bỏ** "Personal Knowledge Base" (planner, trống) — vai trò "kinh nghiệm chung" giờ là note không gắn project.
- **Gộp** "Interview" (knowledge, 0 note) vào **"Technical Interview Prepare"** (planner, 44 task).
- Giữ nguyên: Company Project, FE - Company project, Personal KB project, SASS idea, Cách sử dụng llm trong development.

## 10. Deploy & cut-over

- Repo mới **`personal-kb-v2`** (`new-account/`), GitHub tài khoản cá nhân.
- CI/CD như cũ: GitHub Actions → GHCR → self-hosted runner trên VPS chạy compose.
- **Chạy song song:** port **4200/4201** (4100 đã dùng cho Tết flights), DB `personal_kb_v2`, Qdrant dùng chung (collection mới).
- RAM: nếu VPS đuối khi 2 bản cùng load MiniLM → tắt module semantic ở v2 tới khi cut-over.
- **Cut-over sau Phase 2**: chạy lại migration lần cuối → chuyển v2 sang 4000/4001 → tắt bản cũ → giữ DB cũ thêm 1 tháng rồi xóa.

## 11. Phases

| Phase | Nội dung |
|---|---|
| **1 — Lõi** | Skeleton (auth, layout, migrations, API client theo module, CI/CD) · Project · Task (checklist, kanban, Today, recurring) · Note · Attachments R2 · Keyword search · Migration dữ liệu lõi |
| **2 — Port** | Module English + Diary · Migration dữ liệu English · Check English · Telegram phrase cron → **cut-over** |
| **3 — AI/Search** | AI note tools (tags/summary/rewrite) · Semantic search + RAG · Trích text attachment |

## 12. Việc mở

- [ ] **Kiểm tra firewall VPS cho port 4000/4001 của bản cũ** (bản cũ không có auth) — chưa làm.
- [ ] Phân tích architecture: cấu trúc module NestJS & Next.js, data model chi tiết (ERD), API contract, cách chia sẻ type FE/BE, ranh giới module English (cách port mà vẫn cách ly).
