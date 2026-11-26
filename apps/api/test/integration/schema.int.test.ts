import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { newId } from '../../src/platform/database/ids';
import { booleanQuery } from '../../src/platform/database/fulltext';
import { freshDb, IT_URL } from './db';

describe.skipIf(!IT_URL)('schema invariants on MySQL 8', () => {
  let ds: DataSource;
  let drop: () => Promise<void>;
  let projectId: string;

  beforeAll(async () => {
    ({ ds, drop } = await freshDb());
    projectId = newId();
    await ds.query('INSERT INTO project (id, name) VALUES (?, ?)', [projectId, 'IT']);
  });
  afterAll(async () => drop?.());

  it('migrations are idempotent', async () => {
    expect(await ds.runMigrations()).toEqual([]);
  });

  async function recurrence() {
    const id = newId();
    await ds.query(
      `INSERT INTO task_recurrence (id, project_id, title, priority, rule, anchor_date, status, checklist_template) VALUES (?, ?, 'daily', 1, '{"kind":"daily"}', '2026-01-01', 'active', '[]')`,
      [id, projectId],
    );
    return id;
  }
  const task = (recId: string | null, status = 'todo', pos = 'a') =>
    ds.query(`INSERT INTO task (id, project_id, title, status, priority, position, recurrence_id, due_date) VALUES (?, ?, 't', ?, 1, ?, ?, '2026-01-01')`, [
      newId(),
      projectId,
      status,
      pos,
      recId,
    ]);

  it('allows ONE open instance per recurring series (open_slot), any number when done', async () => {
    const rec = await recurrence();
    await task(rec, 'todo');
    await expect(task(rec, 'doing', 'b')).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    await ds.query("UPDATE task SET status = 'done', completed_at = NOW(3) WHERE recurrence_id = ?", [rec]);
    await task(rec, 'todo', 'c');
    await task(rec, 'done', 'd');
    const [{ n }] = await ds.query('SELECT COUNT(*) AS n FROM task WHERE recurrence_id = ?', [rec]);
    expect(Number(n)).toBe(3);
  });

  it('one-off tasks are never limited by open_slot', async () => {
    await task(null);
    await task(null, 'todo', 'b');
  });

  it('a note belongs to a project OR a task, never both (CHECK)', async () => {
    const [t] = await ds.query('SELECT id FROM task LIMIT 1');
    await expect(
      ds.query('INSERT INTO note (id, title, content, project_id, task_id) VALUES (?, ?, ?, ?, ?)', [newId(), 'x', 'y', projectId, t.id]),
    ).rejects.toMatchObject({ code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
  });

  it('deleting a project that still has notes is refused (FK RESTRICT)', async () => {
    const p = newId();
    await ds.query('INSERT INTO project (id, name) VALUES (?, ?)', [p, 'has-notes']);
    await ds.query('INSERT INTO note (id, title, content, project_id) VALUES (?, ?, ?, ?)', [newId(), 'n', 'c', p]);
    await expect(ds.query('DELETE FROM project WHERE id = ?', [p])).rejects.toMatchObject({ code: 'ER_ROW_IS_REFERENCED_2' });
  });

  it('FULLTEXT finds notes and attachment text with prefix matching', async () => {
    const id = newId();
    await ds.query('INSERT INTO note (id, title, content) VALUES (?, ?, ?)', [id, 'Kafka consumer rebalance', 'cooperative sticky assignor']);
    await ds.query("INSERT INTO attachment (id, note_id, storage_key, filename, mime, size, status, text_content) VALUES (?, ?, 'k', 'runbook.pdf', 'application/pdf', 1, 'ready', 'redis eviction allkeys-lru')", [newId(), id]);
    const hits = await ds.query('SELECT id FROM note WHERE MATCH(title, content) AGAINST (? IN BOOLEAN MODE)', [booleanQuery('rebal assign')]);
    expect(hits.map((h: { id: string }) => h.id)).toContain(id);
    const files = await ds.query('SELECT note_id FROM attachment WHERE MATCH(filename, text_content) AGAINST (? IN BOOLEAN MODE)', [booleanQuery('evict')]);
    expect(files.map((h: { note_id: string }) => h.note_id)).toContain(id);
  });

  it('english cards are deleted with their journal (in-module FK), and nothing in english_* references core', async () => {
    const j = newId();
    await ds.query("INSERT INTO english_journal (id, title, content) VALUES (?, 'j', 'c')", [j]);
    await ds.query("INSERT INTO english_card (id, kind, title, front, journal_id) VALUES (?, 'VOCAB', 'w', 'w', ?)", [newId(), j]);
    await ds.query('DELETE FROM english_journal WHERE id = ?', [j]);
    const [{ n }] = await ds.query('SELECT COUNT(*) AS n FROM english_card WHERE journal_id = ?', [j]);
    expect(Number(n)).toBe(0);
    const fks = await ds.query(
      `SELECT TABLE_NAME AS t, REFERENCED_TABLE_NAME AS r FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL AND (TABLE_NAME LIKE 'english%' OR TABLE_NAME LIKE 'diary%')`,
    );
    expect(fks.filter((f: { r: string }) => !f.r.startsWith('english'))).toEqual([]);
  });
});
