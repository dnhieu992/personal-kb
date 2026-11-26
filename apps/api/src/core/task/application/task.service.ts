import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ChecklistItem,
  CompleteTaskResult,
  CreateTaskInput,
  describeRule,
  MoveTaskInput,
  Page,
  positionBetween,
  Task,
  TaskDetail,
  TaskListQuery,
  TaskStatus,
  TaskSummary,
  Today,
  UpdateChecklistItemInput,
  UpdateTaskInput,
} from '@pkb/contracts';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { ProjectService } from '../../project';
import { Clock } from '../../../platform/clock/clock';
import { decodeCursor, encodeCursor } from '../../../platform/database/cursor';
import { isDuplicate } from '../../../platform/database/db-errors';
import { booleanQuery, likePattern, snippet } from '../../../platform/database/fulltext';
import { newId } from '../../../platform/database/ids';
import { nextDue } from '../domain/recurrence';
import { groupToday } from '../domain/today';
import { ChecklistItemEntity } from '../infra/checklist-item.entity';
import { RecurrenceEntity } from '../infra/recurrence.entity';
import { TaskEntity } from '../infra/task.entity';
import { insertChecklist, InstanceFactory, nextPosition } from './instance.factory';
import { toChecklistItem, toSummary, toTask } from './task.mapper';

const OLD_DONE_DAYS = 14;

export interface TaskSearchHit {
  id: string;
  title: string;
  snippet: string;
  projectId: string;
  status: TaskStatus;
  score: number;
  updatedAt: Date;
}

@Injectable()
export class TaskService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(ChecklistItemEntity) private readonly checklist: Repository<ChecklistItemEntity>,
    private readonly projects: ProjectService,
    private readonly instances: InstanceFactory,
    private readonly clock: Clock,
  ) {}

  // ---------- queries ----------

  async list(q: TaskListQuery): Promise<Page<TaskSummary>> {
    const qb = this.tasks.createQueryBuilder('t');
    if (q.projectId) qb.andWhere('t.projectId = :p', { p: q.projectId });
    if (q.status) qb.andWhere('t.status = :s', { s: q.status });
    if (!q.includeOldDone) {
      const cutoff = new Date(this.clock.now().getTime() - OLD_DONE_DAYS * 86_400_000);
      qb.andWhere("(t.status <> 'done' OR t.completedAt IS NULL OR t.completedAt >= :cutoff)", { cutoff });
    }
    const c = decodeCursor(q.cursor);
    if (c) {
      qb.andWhere(new Brackets((w) => w.where('t.position > :cp', { cp: c[0] }).orWhere('t.position = :cp AND t.id > :ci', { ci: c[1] })));
    }
    const rows = await qb.orderBy('t.position', 'ASC').addOrderBy('t.id', 'ASC').take(q.limit + 1).getMany();
    const more = rows.length > q.limit;
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return { items: await this.summaries(page), nextCursor: more && last ? encodeCursor(last.position, last.id) : null };
  }

  async detail(id: string): Promise<TaskDetail> {
    const t = await this.entity(id);
    const [summary] = await this.summaries([t]);
    const items = await this.checklist.find({ where: { taskId: id }, order: { position: 'ASC', id: 'ASC' } });
    let recurrence: TaskDetail['recurrence'] = null;
    if (t.recurrenceId) {
      const r = await this.db.manager.findOneByOrFail(RecurrenceEntity, { id: t.recurrenceId });
      recurrence = { id: r.id, describe: describeRule(r.rule), status: r.status };
    }
    return { ...summary, checklist: items.map(toChecklistItem), recurrence };
  }

  /** Public for other modules (notes): does the task exist, and where does it live? */
  async ref(id: string): Promise<{ id: string; title: string; projectId: string }> {
    const t = await this.entity(id);
    return { id: t.id, title: t.title, projectId: t.projectId };
  }

  async refsByIds(ids: string[]): Promise<Map<string, { id: string; title: string; projectId: string }>> {
    if (!ids.length) return new Map();
    const rows = await this.tasks.find({ where: { id: In([...new Set(ids)]) }, select: ['id', 'title', 'projectId'] });
    return new Map(rows.map((r) => [r.id, { id: r.id, title: r.title, projectId: r.projectId }]));
  }

  /** Ids of every task in a project (notes filter "everything under project X"). */
  async idsInProject(projectId: string): Promise<string[]> {
    const rows = await this.tasks.find({ where: { projectId }, select: ['id'] });
    return rows.map((r) => r.id);
  }

  async today(): Promise<Today> {
    const today = this.clock.today();
    const rows = await this.tasks
      .createQueryBuilder('t')
      .where("t.status <> 'done'")
      .andWhere(
        new Brackets((w) =>
          w.where('t.dueDate <= :today', { today }).orWhere("t.status = 'doing'").orWhere('t.pinnedFor = :today', { today }),
        ),
      )
      .getMany();
    const summaries = await this.summaries(rows);
    return { date: today, ...groupToday(summaries, today) };
  }

  async countsByProject(): Promise<Map<string, { open: number; done: number }>> {
    const rows = await this.tasks
      .createQueryBuilder('t')
      .select('t.projectId', 'projectId')
      .addSelect("SUM(t.status <> 'done')", 'open')
      .addSelect("SUM(t.status = 'done')", 'done')
      .groupBy('t.projectId')
      .getRawMany<{ projectId: string; open: string; done: string }>();
    return new Map(rows.map((r) => [r.projectId, { open: Number(r.open), done: Number(r.done) }]));
  }

  async search(q: string, projectId: string | undefined, limit: number): Promise<TaskSearchHit[]> {
    const ft = booleanQuery(q);
    const qb = this.tasks.createQueryBuilder('t').select(['t.id', 't.title', 't.description', 't.projectId', 't.status', 't.updatedAt']);
    if (ft) {
      qb.addSelect('MATCH(t.title, t.description) AGAINST (:ft IN BOOLEAN MODE)', 'score')
        .where('MATCH(t.title, t.description) AGAINST (:ft IN BOOLEAN MODE)', { ft })
        .orderBy('score', 'DESC');
    } else {
      qb.addSelect('1', 'score')
        .where('(t.title LIKE :like OR t.description LIKE :like)', { like: likePattern(q) })
        .orderBy('t.updatedAt', 'DESC');
    }
    if (projectId) qb.andWhere('t.projectId = :projectId', { projectId });
    const { entities, raw } = await qb.limit(limit).getRawAndEntities();
    return entities.map((e, i) => ({
      id: e.id,
      title: e.title,
      snippet: snippet(e.description, q),
      projectId: e.projectId,
      status: e.status,
      score: Number(raw[i]?.score ?? 0),
      updatedAt: e.updatedAt,
    }));
  }

  // ---------- commands ----------

  async create(input: CreateTaskInput): Promise<TaskDetail> {
    await this.projects.assertExists(input.projectId);
    const id = newId();
    await this.db.transaction(async (m) => {
      await m.insert(TaskEntity, {
        id,
        projectId: input.projectId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
        pinnedFor: input.pinnedForToday ? this.clock.today() : null,
        position: await nextPosition(m, input.projectId, input.status),
        recurrenceId: null,
        completedAt: input.status === 'done' ? this.clock.now() : null,
      });
      await insertChecklist(m, id, input.checklist ?? []);
    });
    return this.detail(id);
  }

  async update(id: string, input: UpdateTaskInput): Promise<TaskDetail> {
    const t = await this.entity(id);
    if (input.projectId !== undefined && input.projectId !== t.projectId) {
      if (t.recurrenceId) throw new BadRequestException('Move the recurring series instead of one instance.');
      await this.projects.assertExists(input.projectId);
      t.projectId = input.projectId;
      t.position = await nextPosition(this.db.manager, input.projectId, t.status);
    }
    if (input.title !== undefined) t.title = input.title;
    if (input.description !== undefined) t.description = input.description;
    if (input.priority !== undefined) t.priority = input.priority;
    if (input.dueDate !== undefined) t.dueDate = input.dueDate;
    if (input.pinnedForToday !== undefined) t.pinnedFor = input.pinnedForToday ? this.clock.today() : null;
    await this.tasks.save(t);
    return this.detail(id);
  }

  /** Kanban drop. Moving into `done` runs the completion flow (spawns the next recurring instance). */
  async move(id: string, input: MoveTaskInput): Promise<CompleteTaskResult> {
    return this.db.transaction(async (m) => {
      const t = await this.lock(m, id);
      const position = await this.positionFor(m, t.projectId, input.status, input.beforeId ?? null, input.afterId ?? null, id);
      if (input.status === 'done' && t.status !== 'done') {
        t.position = position;
        return this.completeLocked(m, t);
      }
      if (t.status === 'done' && input.status !== 'done') t.completedAt = null;
      t.status = input.status;
      t.position = position;
      await this.saveStatus(m, t);
      return { task: toTask(t), next: null };
    });
  }

  async complete(id: string): Promise<CompleteTaskResult> {
    return this.db.transaction(async (m) => {
      const t = await this.lock(m, id);
      if (t.status === 'done') return { task: toTask(t), next: null };
      t.position = await nextPosition(m, t.projectId, 'done');
      return this.completeLocked(m, t);
    });
  }

  async setStatus(id: string, status: TaskStatus): Promise<CompleteTaskResult> {
    if (status === 'done') return this.complete(id);
    return this.db.transaction(async (m) => {
      const t = await this.lock(m, id);
      if (t.status === status) return { task: toTask(t), next: null };
      t.position = await nextPosition(m, t.projectId, status);
      if (t.status === 'done') t.completedAt = null;
      t.status = status;
      await this.saveStatus(m, t);
      return { task: toTask(t), next: null };
    });
  }

  /**
   * Deleting a task. For the open instance of an active series this is a "skip": the
   * next occurrence is created in the same transaction. Notes still attached → 409 (FK).
   */
  async remove(id: string): Promise<{ next: Task | null }> {
    return this.db.transaction(async (m) => {
      const t = await this.lock(m, id);
      await m.delete(TaskEntity, id);
      if (t.recurrenceId && t.status !== 'done') {
        const rec = await m.findOneByOrFail(RecurrenceEntity, { id: t.recurrenceId });
        if (rec.status === 'active') {
          const titles = (await m.find(ChecklistItemEntity, { where: { taskId: id } })).map((c) => c.title);
          const next = await this.instances.spawn(m, rec, nextDue(rec.rule, t.dueDate ?? this.clock.today()), titles);
          return { next: toTask(next) };
        }
      }
      return { next: null };
    });
  }

  // ---------- checklist ----------

  async addChecklistItem(taskId: string, title: string): Promise<ChecklistItem> {
    await this.entity(taskId);
    const row = await this.checklist
      .createQueryBuilder('c')
      .select('MAX(c.position)', 'max')
      .where('c.taskId = :taskId', { taskId })
      .getRawOne<{ max: string | null }>();
    const item = this.checklist.create({ id: newId(), taskId, title, done: false, position: positionBetween(row?.max ?? null, null) });
    await this.checklist.insert(item);
    return toChecklistItem(item);
  }

  async updateChecklistItem(id: string, input: UpdateChecklistItemInput): Promise<ChecklistItem> {
    const item = await this.checklist.findOneBy({ id });
    if (!item) throw new NotFoundException('Checklist item not found');
    if (input.title !== undefined) item.title = input.title;
    if (input.done !== undefined) item.done = input.done;
    if (input.beforeId !== undefined || input.afterId !== undefined) {
      const pos = async (nid?: string | null) =>
        nid ? (await this.checklist.findOneBy({ id: nid, taskId: item.taskId }))?.position ?? null : null;
      item.position = positionBetween(await pos(input.beforeId), await pos(input.afterId));
    }
    await this.checklist.save(item);
    return toChecklistItem(item);
  }

  async removeChecklistItem(id: string): Promise<void> {
    await this.checklist.delete(id);
  }

  // ---------- internals ----------

  private async completeLocked(m: EntityManager, t: TaskEntity): Promise<CompleteTaskResult> {
    t.status = 'done';
    t.completedAt = this.clock.now();
    await this.saveStatus(m, t);
    let next: TaskEntity | null = null;
    if (t.recurrenceId) {
      const rec = await m.findOneByOrFail(RecurrenceEntity, { id: t.recurrenceId });
      if (rec.status === 'active') {
        // Calendar-based: next due derives from this instance's due date, not from today.
        const due = nextDue(rec.rule, t.dueDate ?? this.clock.today());
        // Copy the checklist (reset to not-done); notes/attachments stay with the old instance.
        const items = await m.find(ChecklistItemEntity, { where: { taskId: t.id }, order: { position: 'ASC' } });
        next = await this.instances.spawn(m, rec, due, items.length ? items.map((i) => i.title) : rec.checklistTemplate);
      }
    }
    return { task: toTask(t), next: next ? toTask(next) : null };
  }

  private async saveStatus(m: EntityManager, t: TaskEntity) {
    try {
      await m.update(TaskEntity, t.id, { status: t.status, position: t.position, completedAt: t.completedAt });
    } catch (e) {
      if (isDuplicate(e)) throw new ConflictException('This recurring series already has an open instance — finish or delete that one first.');
      throw e;
    }
  }

  private async positionFor(m: EntityManager, projectId: string, status: string, beforeId: string | null, afterId: string | null, selfId: string) {
    const get = async (id: string | null) => {
      if (!id || id === selfId) return null;
      const n = await m.findOneBy(TaskEntity, { id, projectId, status: status as TaskStatus });
      return n?.position ?? null;
    };
    const before = await get(beforeId);
    const after = await get(afterId);
    if (before === null && after === null) return nextPosition(m, projectId, status);
    if (before !== null && after !== null && before >= after) return positionBetween(before, null);
    return positionBetween(before, after);
  }

  private async lock(m: EntityManager, id: string): Promise<TaskEntity> {
    const t = await m.createQueryBuilder(TaskEntity, 't').where('t.id = :id', { id }).setLock('pessimistic_write').getOne();
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  private async entity(id: string): Promise<TaskEntity> {
    const t = await this.tasks.findOneBy({ id });
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  private async summaries(rows: TaskEntity[]): Promise<TaskSummary[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [projects, counts] = await Promise.all([
      this.projects.byIds(rows.map((r) => r.projectId)),
      this.checklist
        .createQueryBuilder('c')
        .select('c.taskId', 'taskId')
        .addSelect('SUM(c.done)', 'done')
        .addSelect('COUNT(*)', 'total')
        .where('c.taskId IN (:...ids)', { ids })
        .groupBy('c.taskId')
        .getRawMany<{ taskId: string; done: string; total: string }>(),
    ]);
    const cm = new Map(counts.map((c) => [c.taskId, { done: Number(c.done), total: Number(c.total) }]));
    return rows.map((r) => toSummary(r, projects.get(r.projectId), cm.get(r.id)));
  }
}

