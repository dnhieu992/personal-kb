/**
 * One-shot ETL: v1 database (personal_kb) → v2 (personal_kb_v2). Phase 1 = core data only:
 *   project (knowledge) + planner_project  → project
 *   planner_task + planner_checklist_item → task + checklist_item
 *   knowledge (non-ENGLISH)              → note (+ tags; old `type` becomes a tag)
 * Phase 2 = isolated modules:
 *   knowledge ENGLISH/JOURNAL → english_journal; other ENGLISH kinds → english_card
 *   course_* → english_course_* · phrase → english_phrase · game_progress → english_game_progress
 *   planner_correction → english_correction · diary_entry → diary_entry
 *
 * IDEMPOTENT — safe to re-run at cut-over:
 *   - ids are deterministic (v1 UUIDs kept; int ids → UUID v5 of "<table>:<id>")
 *   - every write is INSERT … ON DUPLICATE KEY UPDATE
 *   - rows created directly in v2 are never touched
 *
 * Usage (after `node dist/migrate.js`):
 *   V1_DATABASE_URL=mysql://…/personal_kb DATABASE_URL=mysql://…/personal_kb_v2 node dist/scripts/migrate-v1.js [--dry-run]
 */
import { positionBetween } from '@pkb/contracts';
import { createConnection, Connection, RowDataPacket } from 'mysql2/promise';
import { v5 } from 'uuid';
import { loadDotenv } from '../platform/config/load-dotenv';

const NS = '6b1f5c1e-3a52-4f0e-9a51-3c1d2f4a8b70'; // fixed namespace for v1 int ids
const idFor = (table: string, id: number | string) => v5(`${table}:${id}`, NS);

// SPEC §9 project mapping
const DROP_PROJECTS = ['Personal Knowledge Base']; // planner project, empty; "general knowledge" = notes without project
const MERGE_INTO: Record<string, string> = { Interview: 'Technical Interview Prepare' };
const INBOX = 'Inbox'; // only created if some planner task has no project

const PRIORITY = [1, 0, 1, 2]; // v1: 0 none,1 low,2 medium,3 high → v2: 0 low,1 medium,2 high,3 urgent
const TYPE_TAG: Record<string, string> = {
  BUG_FIX: 'bug-fix',
  HOW_TO: 'how-to',
  ARCHITECTURE: 'architecture',
  INSIGHT: 'insight',
  DAILY_LOG: 'daily-log',
};

type Row = RowDataPacket & Record<string, any>;

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    // TypeORM simple-array style fallback
    return v.split(',').map((s) => s.trim()).filter(Boolean) as unknown as T;
  }
}

function normTag(t: string): string | null {
  const v = String(t).trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, ' ').slice(0, 60);
  return /^[\p{L}\p{N}][\p{L}\p{N} ._+#-]*$/u.test(v) ? v : null;
}

async function tableExists(c: Connection, name: string): Promise<boolean> {
  const [rows] = await c.query<Row[]>('SHOW TABLES LIKE ?', [name]);
  return rows.length > 0;
}

async function main() {
  loadDotenv();
  const dry = process.argv.includes('--dry-run');
  const v1Url = process.env.V1_DATABASE_URL;
  const v2Url = process.env.DATABASE_URL;
  if (!v1Url || !v2Url) throw new Error('V1_DATABASE_URL and DATABASE_URL are required');
  if (v1Url === v2Url) throw new Error('V1 and V2 must be different databases');

  const v1 = await createConnection({ uri: v1Url, dateStrings: true });
  const v2 = await createConnection({ uri: v2Url, timezone: 'Z', charset: 'utf8mb4_unicode_ci' });
  const [[mig]] = await v2.query<Row[]>("SELECT COUNT(*) AS n FROM schema_migrations WHERE name = 'EnglishDiaryAi1764300000000'");
  if (!mig?.n) throw new Error('v2 schema missing — run `node dist/migrate.js` first');

  const stats: Record<string, number> = {};
  const bump = (k: string, n = 1) => (stats[k] = (stats[k] ?? 0) + n);

  await v2.beginTransaction();
  try {
    // ---------- projects ----------
    const projectIdByName = new Map<string, string>();
    const [existing] = await v2.query<Row[]>('SELECT id, name FROM project');
    for (const p of existing) projectIdByName.set(p.name, p.id);

    async function upsertProject(id: string, name: string, description: string | null, createdAt: string | null) {
      const owner = projectIdByName.get(name);
      if (owner && owner !== id) return owner; // same name already exists (merge)
      await v2.query(
        `INSERT INTO project (id, name, description, color, created_at) VALUES (?, ?, ?, NULL, COALESCE(?, NOW(3)))
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
        [id, name, description, createdAt],
      );
      projectIdByName.set(name, id);
      bump('project');
      return id;
    }

    const knowledgeProjectMap = new Map<string, string>(); // v1 uuid → v2 id
    const plannerProjectMap = new Map<number, string>(); // v1 int → v2 id

    // planner projects first: they are the merge targets
    if (await tableExists(v1, 'planner_project')) {
      const [rows] = await v1.query<Row[]>('SELECT * FROM planner_project ORDER BY sort, id');
      for (const r of rows) {
        if (DROP_PROJECTS.includes(r.name)) {
          bump('project.dropped');
          continue;
        }
        plannerProjectMap.set(r.id, await upsertProject(idFor('planner_project', r.id), r.name, r.description ?? null, r.createdAt));
      }
    }
    if (await tableExists(v1, 'project')) {
      const [rows] = await v1.query<Row[]>('SELECT * FROM project ORDER BY createdAt');
      for (const r of rows) {
        const target = MERGE_INTO[r.name];
        if (target && projectIdByName.has(target)) {
          knowledgeProjectMap.set(r.id, projectIdByName.get(target)!);
          bump('project.merged');
          continue;
        }
        knowledgeProjectMap.set(r.id, await upsertProject(r.id, r.name, r.description ?? null, r.createdAt));
      }
    }

    // ---------- tasks + checklist ----------
    if (await tableExists(v1, 'planner_task')) {
      const [tasks] = await v1.query<Row[]>('SELECT * FROM planner_task WHERE hidden = 0 ORDER BY sort, id');
      const [items] = await v1.query<Row[]>('SELECT * FROM planner_checklist_item ORDER BY sort, id');
      const itemsByTask = new Map<number, Row[]>();
      for (const i of items) itemsByTask.set(i.taskId, [...(itemsByTask.get(i.taskId) ?? []), i]);

      const lastPos = new Map<string, string | null>();
      for (const t of tasks) {
        let projectId = t.projectId != null ? plannerProjectMap.get(t.projectId) : undefined;
        if (!projectId) projectId = projectIdByName.get(INBOX) ?? (await upsertProject(idFor('inbox', 1), INBOX, 'Tasks migrated from v1 without a project.', null));

        const status = t.done ? 'done' : t.inProgress ? 'doing' : 'todo';
        const key = `${projectId}:${status}`;
        const position = positionBetween(lastPos.get(key) ?? null, null);
        lastPos.set(key, position);

        const tags = parseJson<string[]>(t.tags, []);
        const parts = [t.notes?.trim(), t.result?.trim() ? `## Result\n\n${t.result.trim()}` : null, tags.length ? `Tags: ${tags.map((x) => `#${x}`).join(' ')}` : null].filter(Boolean);
        const id = idFor('planner_task', t.id);
        await v2.query(
          `INSERT INTO task (id, project_id, title, description, status, priority, due_date, pinned_for, position, recurrence_id, completed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, COALESCE(?, NOW(3)))
           ON DUPLICATE KEY UPDATE project_id = VALUES(project_id), title = VALUES(title), description = VALUES(description),
             status = VALUES(status), priority = VALUES(priority), due_date = VALUES(due_date), position = VALUES(position),
             completed_at = VALUES(completed_at)`,
          [
            id,
            projectId,
            String(t.title).slice(0, 300),
            parts.length ? parts.join('\n\n') : null,
            status,
            PRIORITY[t.priority] ?? 1,
            t.date || null,
            position,
            t.done ? t.doneAt ?? t.createdAt ?? null : null,
            t.createdAt ?? null,
          ],
        );
        bump(`task.${status}`);

        let prev: string | null = null;
        for (const i of itemsByTask.get(t.id) ?? []) {
          prev = positionBetween(prev, null);
          await v2.query(
            `INSERT INTO checklist_item (id, task_id, title, done, position) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), done = VALUES(done), position = VALUES(position)`,
            [idFor('planner_checklist_item', i.id), id, String(i.title).slice(0, 500), i.done ? 1 : 0, prev],
          );
          bump('checklist_item');
        }
      }
    }

    // ---------- notes ----------
    if (await tableExists(v1, 'knowledge')) {
      const [rows] = await v1.query<Row[]>("SELECT * FROM knowledge WHERE type <> 'ENGLISH' ORDER BY createdAt");
      for (const k of rows) {
        const tags = [...parseJson<string[]>(k.tags, []), TYPE_TAG[k.type] ?? String(k.type).toLowerCase()]
          .map(normTag)
          .filter((x): x is string => !!x);
        const uniqueTags = [...new Set(tags)].slice(0, 30);
        // v1 images live in the OLD public bucket: keep them as links (Phase-1 decision; copy into the
        // private bucket later if the old bucket is to be deleted).
        const images = parseJson<{ url?: string; name?: string }[]>(k.images, []).filter((i) => i?.url);
        let content: string = k.content ?? '';
        const missing = images.filter((i) => !content.includes(i.url!));
        if (missing.length) content += `\n\n## Attachments (v1)\n\n${missing.map((i) => `- [${i.name ?? 'file'}](${i.url})`).join('\n')}`;
        const projectId = k.projectId ? knowledgeProjectMap.get(k.projectId) ?? null : null;

        await v2.query(
          `INSERT INTO note (id, title, content, project_id, task_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, COALESCE(?, NOW(3)), COALESCE(?, NOW(3)))
           ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), project_id = VALUES(project_id), updated_at = VALUES(updated_at)`,
          [k.id, String(k.title).slice(0, 300), content, projectId, k.createdAt ?? null, k.updatedAt ?? null],
        );
        bump('note');

        await v2.query('DELETE FROM note_tag WHERE note_id = ?', [k.id]);
        for (const name of uniqueTags) {
          await v2.query('INSERT IGNORE INTO tag (id, name) VALUES (?, ?)', [idFor('tag', name), name]);
          await v2.query('INSERT IGNORE INTO note_tag (note_id, tag_id) SELECT ?, id FROM tag WHERE name = ?', [k.id, name]);
          bump('note_tag');
        }
      }
    }

    // ---------- English: journal + cards ----------
    if (await tableExists(v1, 'knowledge')) {
      const [eng] = await v1.query<Row[]>("SELECT * FROM knowledge WHERE type = 'ENGLISH' ORDER BY createdAt");
      const journals = eng.filter((k) => k.englishKind === 'JOURNAL');
      const journalIds = new Set(journals.map((j) => j.id));
      for (const j of journals) {
        await v2.query(
          `INSERT INTO english_journal (id, title, content, summary, images, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, COALESCE(?, NOW(3)), COALESCE(?, NOW(3)))
           ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), summary = VALUES(summary), images = VALUES(images)`,
          [j.id, String(j.title).slice(0, 255), j.content ?? '', j.summary ?? null, JSON.stringify(parseJson(j.images, [])), j.createdAt, j.updatedAt],
        );
        bump('english_journal');
      }
      // where a card came from: v1 kept a bare sourceId (entry, task, lesson…); v2 keeps text + a link
      const [titled] = await v1.query<Row[]>("SELECT id, title FROM knowledge WHERE type <> 'ENGLISH'");
      const noteTitle = new Map(titled.map((r) => [r.id, r.title]));
      const lessonTitle = new Map<string, string>();
      if (await tableExists(v1, 'course_lesson')) {
        const [ls] = await v1.query<Row[]>('SELECT id, title FROM course_lesson');
        for (const l of ls) lessonTitle.set(l.id, l.title);
      }
      const KINDS = ['SENTENCE', 'GRAMMAR', 'MISTAKE', 'VOCAB'];
      for (const k of eng) {
        if (k.englishKind === 'JOURNAL') continue;
        const sid: string | null = k.sourceId ?? null;
        let journalId: string | null = null;
        let source: string | null = null;
        let sourceUrl: string | null = null;
        if (sid && journalIds.has(sid)) journalId = sid;
        else if (sid && noteTitle.has(sid)) [source, sourceUrl] = [`Note: ${noteTitle.get(sid)}`, `/notes/${sid}`];
        else if (sid && lessonTitle.has(sid)) [source, sourceUrl] = [`Lesson: ${lessonTitle.get(sid)}`, `/english/lesson/${sid}`];
        else if (sid) source = sid === 'tech-notes' ? 'Tech notes (v1)' : 'v1';
        await v2.query(
          `INSERT INTO english_card (id, kind, title, front, meaning, cefr_level, hard, review_count, correct_count, last_reviewed_at,
             journal_id, source, source_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW(3)), COALESCE(?, NOW(3)))
           ON DUPLICATE KEY UPDATE kind = VALUES(kind), title = VALUES(title), front = VALUES(front), meaning = VALUES(meaning),
             cefr_level = VALUES(cefr_level), hard = VALUES(hard), review_count = VALUES(review_count),
             correct_count = VALUES(correct_count), last_reviewed_at = VALUES(last_reviewed_at)`,
          [
            k.id,
            KINDS.includes(k.englishKind) ? k.englishKind : 'SENTENCE',
            String(k.title).slice(0, 255),
            k.content ?? '',
            k.summary ?? null,
            k.cefrLevel ?? null,
            k.hard ? 1 : 0,
            k.reviewCount ?? 0,
            k.correctCount ?? 0,
            k.lastReviewedAt ?? null,
            journalId,
            source?.slice(0, 300) ?? null,
            sourceUrl,
            k.createdAt,
            k.updatedAt,
          ],
        );
        bump('english_card');
      }
    }

    // ---------- English course/phrase/games + diary: same columns, renamed tables ----------
    const COPY: [string, string][] = [
      ['course_unit', 'english_course_unit'],
      ['course_lesson', 'english_course_lesson'],
      ['course_attempt', 'english_course_attempt'],
      ['course_exercise_stat', 'english_course_exercise_stat'],
      ['course_placement', 'english_course_placement'],
      ['course_listening', 'english_course_listening'],
      ['course_goal', 'english_course_goal'],
      ['phrase', 'english_phrase'],
      ['game_progress', 'english_game_progress'],
      ['diary_entry', 'diary_entry'],
    ];
    for (const [from, to] of COPY) {
      if (!(await tableExists(v1, from))) continue;
      const [cols] = await v2.query<Row[]>(
        'SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
        [to],
      );
      const [rows] = await v1.query<Row[]>(`SELECT * FROM \`${from}\``);
      if (!rows.length) continue;
      const names = cols.map((r) => r.c as string).filter((c) => c in rows[0]);
      const pk = to === 'english_game_progress' ? 'key' : 'id';
      const list = names.map((c) => `\`${c}\``).join(', ');
      const upd = names.filter((c) => c !== pk).map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
      for (const r of rows) {
        const values = names.map((c) => {
          const v = r[c];
          if (c === 'id' && from === 'course_goal') return idFor('course_goal', v); // int → uuid
          return v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v;
        });
        await v2.query(`INSERT INTO \`${to}\` (${list}) VALUES (${names.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${upd}`, values);
      }
      bump(to, rows.length);
    }

    if (await tableExists(v1, 'planner_correction')) {
      const [rows] = await v1.query<Row[]>('SELECT * FROM planner_correction');
      for (const r of rows) {
        await v2.query(
          `INSERT INTO english_correction (id, kind, original, corrected, why, source, created_at) VALUES (?, ?, ?, ?, ?, 'Planner (v1)', COALESCE(?, NOW(3)))
           ON DUPLICATE KEY UPDATE original = VALUES(original), corrected = VALUES(corrected), why = VALUES(why)`,
          [idFor('planner_correction', r.id), String(r.kind).slice(0, 20), r.original, r.corrected, r.why, r.createdAt],
        );
      }
      bump('english_correction', rows.length);
    }

    if (dry) {
      await v2.rollback();
      console.log('DRY RUN — rolled back.');
    } else {
      await v2.commit();
    }
  } catch (e) {
    await v2.rollback();
    throw e;
  } finally {
    await v1.end();
    await v2.end();
  }
  console.table(stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
