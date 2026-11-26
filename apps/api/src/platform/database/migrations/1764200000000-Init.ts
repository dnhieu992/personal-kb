import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * v2 core schema. Hand-written SQL on purpose: generated columns, FULLTEXT, CHECK and
 * binary collations are the point here, and they are what ORM sync gets wrong.
 */
export class Init1764200000000 implements MigrationInterface {
  name = 'Init1764200000000';

  async up(q: QueryRunner): Promise<void> {
    const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    await q.query(`
      CREATE TABLE project (
        id CHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT NULL,
        color CHAR(7) NULL,
        archived_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_project_name (name)
      ) ${T}`);

    await q.query(`
      CREATE TABLE task_recurrence (
        id CHAR(36) NOT NULL PRIMARY KEY,
        project_id CHAR(36) NOT NULL,
        title VARCHAR(300) NOT NULL,
        description MEDIUMTEXT NULL,
        priority TINYINT NOT NULL DEFAULT 1,
        rule JSON NOT NULL,
        anchor_date DATE NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'active',
        checklist_template JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        CONSTRAINT fk_recurrence_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE RESTRICT,
        CONSTRAINT ck_recurrence_status CHECK (status IN ('active','paused','ended')),
        CONSTRAINT ck_recurrence_priority CHECK (priority BETWEEN 0 AND 3)
      ) ${T}`);

    // open_slot: equals recurrence_id while the instance is open, NULL otherwise.
    // UNIQUE(open_slot) => at most ONE open instance per series, enforced by the DB even
    // under double-clicks or races. Plain tasks have NULL and are unaffected.
    await q.query(`
      CREATE TABLE task (
        id CHAR(36) NOT NULL PRIMARY KEY,
        project_id CHAR(36) NOT NULL,
        title VARCHAR(300) NOT NULL,
        description MEDIUMTEXT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'todo',
        priority TINYINT NOT NULL DEFAULT 1,
        due_date DATE NULL,
        pinned_for DATE NULL,
        position VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        recurrence_id CHAR(36) NULL,
        completed_at DATETIME(3) NULL,
        open_slot CHAR(36) GENERATED ALWAYS AS (IF(status <> 'done', recurrence_id, NULL)) STORED,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_task_open_slot (open_slot),
        KEY idx_task_project_status_pos (project_id, status, position),
        KEY idx_task_status_due (status, due_date),
        KEY idx_task_pinned (pinned_for),
        FULLTEXT KEY ft_task (title, description),
        CONSTRAINT fk_task_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE RESTRICT,
        CONSTRAINT fk_task_recurrence FOREIGN KEY (recurrence_id) REFERENCES task_recurrence(id) ON DELETE RESTRICT,
        CONSTRAINT ck_task_status CHECK (status IN ('todo','doing','done')),
        CONSTRAINT ck_task_priority CHECK (priority BETWEEN 0 AND 3)
      ) ${T}`);

    await q.query(`
      CREATE TABLE checklist_item (
        id CHAR(36) NOT NULL PRIMARY KEY,
        task_id CHAR(36) NOT NULL,
        title VARCHAR(500) NOT NULL,
        done TINYINT(1) NOT NULL DEFAULT 0,
        position VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        KEY idx_checklist_task (task_id, position),
        CONSTRAINT fk_checklist_task FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE CASCADE
      ) ${T}`);

    // A note hangs off a task OR a project OR nothing. The FKs are RESTRICT (deleting a
    // task/project that still has notes is refused), which is also what lets MySQL accept
    // the XOR CHECK — it forbids CHECKs on columns with SET NULL/CASCADE actions.
    await q.query(`
      CREATE TABLE note (
        id CHAR(36) NOT NULL PRIMARY KEY,
        title VARCHAR(300) NOT NULL,
        content MEDIUMTEXT NOT NULL,
        project_id CHAR(36) NULL,
        task_id CHAR(36) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        KEY idx_note_updated (updated_at, id),
        FULLTEXT KEY ft_note (title, content),
        CONSTRAINT fk_note_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE RESTRICT,
        CONSTRAINT fk_note_task FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE RESTRICT,
        CONSTRAINT ck_note_one_parent CHECK (project_id IS NULL OR task_id IS NULL)
      ) ${T}`);

    await q.query(`
      CREATE TABLE tag (
        id CHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_tag_name (name)
      ) ${T}`);

    await q.query(`
      CREATE TABLE note_tag (
        note_id CHAR(36) NOT NULL,
        tag_id CHAR(36) NOT NULL,
        PRIMARY KEY (note_id, tag_id),
        KEY idx_note_tag_tag (tag_id),
        CONSTRAINT fk_note_tag_note FOREIGN KEY (note_id) REFERENCES note(id) ON DELETE CASCADE,
        CONSTRAINT fk_note_tag_tag FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE
      ) ${T}`);

    await q.query(`
      CREATE TABLE attachment (
        id CHAR(36) NOT NULL PRIMARY KEY,
        note_id CHAR(36) NOT NULL,
        storage_key VARCHAR(500) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        mime VARCHAR(200) NOT NULL,
        size BIGINT NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'pending',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        KEY idx_attachment_note (note_id),
        KEY idx_attachment_status (status, created_at),
        FULLTEXT KEY ft_attachment (filename),
        CONSTRAINT fk_attachment_note FOREIGN KEY (note_id) REFERENCES note(id) ON DELETE CASCADE,
        CONSTRAINT ck_attachment_status CHECK (status IN ('pending','ready'))
      ) ${T}`);

    await q.query(`
      CREATE TABLE job (
        id CHAR(36) NOT NULL PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        payload JSON NOT NULL,
        status VARCHAR(10) NOT NULL,
        run_at DATETIME(3) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 5,
        locked_until DATETIME(3) NULL,
        last_error TEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        KEY idx_job_status_run (status, run_at)
      ) ${T}`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of ['job', 'attachment', 'note_tag', 'tag', 'note', 'checklist_item', 'task', 'task_recurrence', 'project']) {
      await q.query(`DROP TABLE IF EXISTS ${t}`);
    }
  }
}
