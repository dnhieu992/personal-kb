import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  CreateNoteInput,
  NoteDetail,
  NoteListQuery,
  NoteSummary,
  Page,
  TagCount,
  UpdateNoteInput,
} from '@pkb/contracts';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { ProjectService } from '../../project';
import { TaskService } from '../../task';
import { decodeCursor, encodeCursor, iso } from '../../../platform/database/cursor';
import { booleanQuery, likePattern, snippet } from '../../../platform/database/fulltext';
import { newId } from '../../../platform/database/ids';
import { JobService } from '../../../platform/jobs/job.service';
import { excerpt, normalizeTags, NoteRuleError, resolveParent } from '../domain/note-rules';
import { AttachmentEntity } from '../infra/attachment.entity';
import { NoteTagEntity } from '../infra/note-tag.entity';
import { NoteEntity } from '../infra/note.entity';
import { TagEntity } from '../infra/tag.entity';
import { toAttachment } from './note.mapper';

import { NoteIndexService } from './note-index.service';

export const DELETE_OBJECT_JOB = 'attachment.delete-object';

export interface NoteSearchHit {
  id: string;
  title: string;
  snippet: string;
  projectId: string | null;
  matchedFiles: string[];
  score: number;
  updatedAt: Date;
}

@Injectable()
export class NoteService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(NoteEntity) private readonly notes: Repository<NoteEntity>,
    @InjectRepository(TagEntity) private readonly tags: Repository<TagEntity>,
    private readonly projects: ProjectService,
    private readonly tasks: TaskService,
    private readonly jobs: JobService,
    private readonly index: NoteIndexService,
  ) {}

  // ---------- queries ----------

  async list(q: NoteListQuery): Promise<Page<NoteSummary>> {
    const qb = this.notes.createQueryBuilder('n');
    if (q.taskId) qb.andWhere('n.taskId = :taskId', { taskId: q.taskId });
    if (q.projectId) {
      // "Under project X" = filed on the project itself OR on one of its tasks.
      const taskIds = await this.tasks.idsInProject(q.projectId);
      qb.andWhere(
        new Brackets((w) => {
          w.where('n.projectId = :projectId', { projectId: q.projectId });
          if (taskIds.length) w.orWhere('n.taskId IN (:...taskIds)', { taskIds });
        }),
      );
    }
    if (q.unfiled) qb.andWhere('n.projectId IS NULL AND n.taskId IS NULL');
    if (q.tag) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM note_tag nt JOIN tag tg ON tg.id = nt.tag_id WHERE nt.note_id = n.id AND tg.name = :tag)',
        { tag: q.tag.toLowerCase() },
      );
    }
    const c = decodeCursor(q.cursor);
    if (c) {
      const at = new Date(c[0]);
      qb.andWhere(new Brackets((w) => w.where('n.updatedAt < :at', { at }).orWhere('n.updatedAt = :at AND n.id < :id', { id: c[1] })));
    }
    const rows = await qb.orderBy('n.updatedAt', 'DESC').addOrderBy('n.id', 'DESC').take(q.limit + 1).getMany();
    const more = rows.length > q.limit;
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return {
      items: await this.summaries(page),
      nextCursor: more && last ? encodeCursor(last.updatedAt.toISOString(), last.id) : null,
    };
  }

  async detail(id: string): Promise<NoteDetail> {
    const n = await this.entity(id);
    const [tagMap, attachments, project, task] = await Promise.all([
      this.tagsOf([id]),
      this.db.manager.find(AttachmentEntity, { where: { noteId: id, status: 'ready' }, order: { createdAt: 'ASC' } }),
      n.projectId ? this.projects.get(n.projectId) : null,
      n.taskId ? this.tasks.ref(n.taskId) : null,
    ]);
    const taskProject = task ? await this.projects.get(task.projectId) : null;
    return {
      id: n.id,
      title: n.title,
      content: n.content,
      projectId: n.projectId,
      taskId: n.taskId,
      tags: tagMap.get(id) ?? [],
      createdAt: iso(n.createdAt)!,
      updatedAt: iso(n.updatedAt)!,
      projectName: project?.name ?? taskProject?.name ?? null,
      taskTitle: task?.title ?? null,
      attachments: attachments.map(toAttachment),
    };
  }

  async allTags(): Promise<TagCount[]> {
    const rows = await this.db.query(
      `SELECT t.name AS name, COUNT(nt.note_id) AS count FROM tag t
       JOIN note_tag nt ON nt.tag_id = t.id GROUP BY t.id, t.name ORDER BY count DESC, t.name ASC`,
    );
    return rows.map((r: { name: string; count: string }) => ({ name: r.name, count: Number(r.count) }));
  }

  /** Notes per project, counting notes filed on the project's tasks too. */
  async countsByProject(): Promise<Map<string, number>> {
    const rows = await this.notes.find({ select: ['projectId', 'taskId'] });
    const taskRefs = await this.tasks.refsByIds(rows.filter((r) => r.taskId).map((r) => r.taskId!));
    const out = new Map<string, number>();
    for (const r of rows) {
      const p = r.projectId ?? (r.taskId ? taskRefs.get(r.taskId)?.projectId : undefined);
      if (p) out.set(p, (out.get(p) ?? 0) + 1);
    }
    return out;
  }

  async search(q: string, projectId: string | undefined, tag: string | undefined, limit: number): Promise<NoteSearchHit[]> {
    const ft = booleanQuery(q);
    const like = likePattern(q);
    const params: unknown[] = [];
    let score: string;
    let where: string;
    if (ft) {
      score = `(MATCH(n.title, n.content) AGAINST (? IN BOOLEAN MODE) * 2
        + COALESCE((SELECT MAX(MATCH(a.filename, a.text_content) AGAINST (? IN BOOLEAN MODE)) FROM attachment a WHERE a.note_id = n.id AND a.status = 'ready'), 0)
        + (SELECT COUNT(*) FROM note_tag nt JOIN tag tg ON tg.id = nt.tag_id WHERE nt.note_id = n.id AND tg.name LIKE ?))`;
      params.push(ft, ft, like);
      where = `(MATCH(n.title, n.content) AGAINST (? IN BOOLEAN MODE)
        OR EXISTS (SELECT 1 FROM attachment a WHERE a.note_id = n.id AND a.status = 'ready' AND MATCH(a.filename, a.text_content) AGAINST (? IN BOOLEAN MODE))
        OR EXISTS (SELECT 1 FROM note_tag nt JOIN tag tg ON tg.id = nt.tag_id WHERE nt.note_id = n.id AND tg.name LIKE ?))`;
      params.push(ft, ft, like);
    } else {
      score = '1';
      where = `(n.title LIKE ? OR n.content LIKE ?
        OR EXISTS (SELECT 1 FROM attachment a WHERE a.note_id = n.id AND a.status = 'ready' AND (a.filename LIKE ? OR a.text_content LIKE ?))
        OR EXISTS (SELECT 1 FROM note_tag nt JOIN tag tg ON tg.id = nt.tag_id WHERE nt.note_id = n.id AND tg.name LIKE ?))`;
      params.push(like, like, like, like, like);
    }
    if (projectId) {
      const taskIds = await this.tasks.idsInProject(projectId);
      where += taskIds.length
        ? ` AND (n.project_id = ? OR n.task_id IN (${taskIds.map(() => '?').join(',')}))`
        : ' AND n.project_id = ?';
      params.push(projectId, ...taskIds);
    }
    if (tag) {
      where += ' AND EXISTS (SELECT 1 FROM note_tag nt2 JOIN tag tg2 ON tg2.id = nt2.tag_id WHERE nt2.note_id = n.id AND tg2.name = ?)';
      params.push(tag.toLowerCase());
    }
    const rows: { id: string; title: string; content: string; project_id: string | null; task_id: string | null; updated_at: Date; score: number }[] =
      await this.db.query(
        `SELECT n.id, n.title, n.content, n.project_id, n.task_id, n.updated_at, ${score} AS score
         FROM note n WHERE ${where} ORDER BY score DESC, n.updated_at DESC LIMIT ${Number(limit)}`,
        params,
      );
    if (!rows.length) return [];
    const files = await this.db.manager
      .createQueryBuilder(AttachmentEntity, 'a')
      .select(['a.noteId', 'a.filename'])
      .addSelect('a.textContent')
      .where('a.noteId IN (:...ids) AND a.status = :s', { ids: rows.map((r) => r.id), s: 'ready' })
      .getMany();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const fileMatches = (f: AttachmentEntity) =>
      words.some((w) => f.filename.toLowerCase().includes(w) || (f.textContent ?? '').toLowerCase().includes(w));
    const taskRefs = await this.tasks.refsByIds(rows.filter((r) => r.task_id).map((r) => r.task_id!));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      snippet: snippet(r.content, q),
      projectId: r.project_id ?? (r.task_id ? taskRefs.get(r.task_id)?.projectId ?? null : null),
      matchedFiles: files.filter((f) => f.noteId === r.id && fileMatches(f)).map((f) => f.filename),
      score: Number(r.score),
      updatedAt: new Date(r.updated_at),
    }));
  }

  // ---------- commands ----------

  async create(input: CreateNoteInput): Promise<NoteDetail> {
    const parent = await this.checkParent({ projectId: null, taskId: null }, input);
    const id = newId();
    await this.db.transaction(async (m) => {
      await m.insert(NoteEntity, { id, title: input.title, content: input.content, ...parent });
      await this.setTags(m, id, input.tags);
      await this.index.queueEmbed(m, id);
    });
    return this.detail(id);
  }

  async update(id: string, input: UpdateNoteInput): Promise<NoteDetail> {
    const n = await this.entity(id);
    const parent = await this.checkParent(n, input);
    await this.db.transaction(async (m) => {
      await m.update(NoteEntity, id, {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.content !== undefined && { content: input.content }),
        ...parent,
        updatedAt: new Date(),
      });
      if (input.tags !== undefined) await this.setTags(m, id, input.tags);
      if (input.title !== undefined || input.content !== undefined) await this.index.queueEmbed(m, id);
    });
    return this.detail(id);
  }

  /** Deletes the note; stored files are removed by a job enqueued in the same transaction. */
  async remove(id: string): Promise<void> {
    await this.entity(id);
    await this.db.transaction(async (m) => {
      const atts = await m.find(AttachmentEntity, { where: { noteId: id }, select: ['id', 'storageKey'] });
      for (const a of atts) await this.jobs.enqueue(DELETE_OBJECT_JOB, { key: a.storageKey }, { manager: m });
      await m.delete(NoteEntity, id);
      await this.index.queueUnembed(m, id);
      await m.query('DELETE FROM tag WHERE NOT EXISTS (SELECT 1 FROM note_tag nt WHERE nt.tag_id = tag.id)');
    });
  }

  /** Lightweight refs for other modules (search merges semantic hits with these). */
  async refsByIds(ids: string[]): Promise<Map<string, { id: string; title: string; projectId: string | null; updatedAt: Date }>> {
    if (!ids.length) return new Map();
    const rows = await this.notes.find({ where: { id: In(ids) }, select: ['id', 'title', 'projectId', 'updatedAt'] });
    return new Map(rows.map((r) => [r.id, { id: r.id, title: r.title, projectId: r.projectId, updatedAt: r.updatedAt }]));
  }

  async assertExists(id: string): Promise<void> {
    await this.entity(id);
  }

  // ---------- internals ----------

  private async checkParent(
    current: { projectId: string | null; taskId: string | null },
    patch: { projectId?: string | null; taskId?: string | null },
  ) {
    let parent: { projectId: string | null; taskId: string | null };
    try {
      parent = resolveParent(current, patch);
    } catch (e) {
      if (e instanceof NoteRuleError) throw new BadRequestException(e.message);
      throw e;
    }
    if (parent.taskId && parent.taskId !== current.taskId) await this.tasks.ref(parent.taskId);
    if (parent.projectId && parent.projectId !== current.projectId) await this.projects.assertExists(parent.projectId);
    return parent;
  }

  private async setTags(m: EntityManager, noteId: string, raw: string[]) {
    const names = normalizeTags(raw);
    await m.delete(NoteTagEntity, { noteId });
    if (names.length) {
      await m
        .createQueryBuilder()
        .insert()
        .into(TagEntity)
        .values(names.map((name) => ({ id: newId(), name })))
        .orIgnore()
        .execute();
      const tags = await m.find(TagEntity, { where: { name: In(names) } });
      await m.insert(NoteTagEntity, tags.map((t) => ({ noteId, tagId: t.id })));
    }
    await m.query('DELETE FROM tag WHERE NOT EXISTS (SELECT 1 FROM note_tag nt WHERE nt.tag_id = tag.id)');
  }

  private async tagsOf(noteIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!noteIds.length) return out;
    const rows: { note_id: string; name: string }[] = await this.db.query(
      `SELECT nt.note_id, t.name FROM note_tag nt JOIN tag t ON t.id = nt.tag_id
       WHERE nt.note_id IN (${noteIds.map(() => '?').join(',')}) ORDER BY t.name`,
      noteIds,
    );
    for (const r of rows) out.set(r.note_id, [...(out.get(r.note_id) ?? []), r.name]);
    return out;
  }

  private async summaries(rows: NoteEntity[]): Promise<NoteSummary[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [tagMap, taskRefs, attCounts] = await Promise.all([
      this.tagsOf(ids),
      this.tasks.refsByIds(rows.filter((r) => r.taskId).map((r) => r.taskId!)),
      this.db.query(
        `SELECT note_id, COUNT(*) AS c FROM attachment WHERE status = 'ready' AND note_id IN (${ids.map(() => '?').join(',')}) GROUP BY note_id`,
        ids,
      ) as Promise<{ note_id: string; c: string }[]>,
    ]);
    const projectIds = rows.map((r) => r.projectId ?? (r.taskId ? taskRefs.get(r.taskId)?.projectId : null)).filter((x): x is string => !!x);
    const projects = await this.projects.byIds(projectIds);
    const ac = new Map(attCounts.map((a) => [a.note_id, Number(a.c)]));
    return rows.map((r) => {
      const task = r.taskId ? taskRefs.get(r.taskId) : undefined;
      const pid = r.projectId ?? task?.projectId ?? null;
      return {
        id: r.id,
        title: r.title,
        projectId: r.projectId,
        taskId: r.taskId,
        tags: tagMap.get(r.id) ?? [],
        createdAt: iso(r.createdAt)!,
        updatedAt: iso(r.updatedAt)!,
        excerpt: excerpt(r.content),
        projectName: pid ? projects.get(pid)?.name ?? null : null,
        taskTitle: task?.title ?? null,
        attachmentCount: ac.get(r.id) ?? 0,
      };
    });
  }

  private async entity(id: string): Promise<NoteEntity> {
    const n = await this.notes.findOneBy({ id });
    if (!n) throw new NotFoundException('Note not found');
    return n;
  }
}
