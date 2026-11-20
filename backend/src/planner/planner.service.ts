import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
import { AiService } from '../ai/ai.service';
import {
  AttachmentCreateDto,
  CreateCategoryDto,
  CreateGoalDto,
  CreateNoteDto,
  CreateTaskDto,
  RecurrenceDto,
  UpdateCategoryDto,
  UpdateGoalDto,
  UpdateNoteDto,
  UpdateTaskDto,
} from './dto/planner.dto';
import {
  AREAS,
  Area,
  CorrectionKind,
  GoalPeriod,
  PlannerAttachment,
  PlannerCategory,
  PlannerChecklistItem,
  PlannerCorrection,
  PlannerGoal,
  PlannerNote,
  PlannerRecurrence,
  PlannerTask,
} from './entities/planner.entities';
import {
  DEFAULT_TZ,
  addDays,
  atMinutes,
  daysBetween,
  daysInMonth,
  endOfMonth,
  keysBetween,
  minutesOf,
  startOfMonth,
  startOfWeek,
  todayKey,
  weekday,
} from './planner-dates';
import { parseQuickEntry } from './quick-entry';

export type TaskView = 'today' | 'week' | 'month' | 'all' | 'backlog' | 'overdue' | 'category' | 'goal' | 'search';
export type BoardColumn = 'backlog' | 'doing' | 'done';

export interface TaskDto extends PlannerTask {
  checklistTotal: number;
  checklistDone: number;
  attachmentCount: number;
  isOverdue: boolean;
  /** An English auto-correct for the title is still running. */
  englishPending: boolean;
}

export interface GoalDto extends PlannerGoal {
  progressDone: number;
  progressTotal: number;
}

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);
  private readonly tz: string;
  /** Days whose recurring instances have already been materialized. */
  private ensured = new Set<string>();
  /** "kind:id" of English checks in flight. */
  private pendingEnglish = new Set<string>();

  constructor(
    @InjectRepository(PlannerCategory) private readonly categories: Repository<PlannerCategory>,
    @InjectRepository(PlannerTask) private readonly tasks: Repository<PlannerTask>,
    @InjectRepository(PlannerChecklistItem) private readonly checklist: Repository<PlannerChecklistItem>,
    @InjectRepository(PlannerAttachment) private readonly attachments: Repository<PlannerAttachment>,
    @InjectRepository(PlannerGoal) private readonly goals: Repository<PlannerGoal>,
    @InjectRepository(PlannerRecurrence) private readonly recurrences: Repository<PlannerRecurrence>,
    @InjectRepository(PlannerNote) private readonly notes: Repository<PlannerNote>,
    @InjectRepository(PlannerCorrection) private readonly corrections: Repository<PlannerCorrection>,
    private readonly ai: AiService,
    config: ConfigService,
  ) {
    this.tz = config.get<string>('PLANNER_TZ') || DEFAULT_TZ;
  }

  get timeZone() {
    return this.tz;
  }

  today(): string {
    return todayKey(this.tz);
  }

  // ───────────────────────────── Meta / sidebar ─────────────────────────────

  async meta() {
    const today = this.today();
    await this.ensureRecurring([today]);
    const [categories, overdue, remaining, backlog, correctionCount] = await Promise.all([
      this.categories.find({ order: { sort: 'ASC', id: 'ASC' } }),
      this.countByArea(this.openQb().andWhere('t.recurrenceId IS NULL').andWhere('t.date < :today', { today })),
      this.countByArea(this.openQb().andWhere('t.date = :today', { today })),
      this.countByArea(this.openQb().andWhere('t.date IS NULL')),
      this.corrections.count(),
    ]);
    return {
      today,
      timeZone: this.tz,
      categories,
      overdue,
      remainingToday: remaining,
      backlog,
      correctionCount,
      englishPending: this.pendingEnglish.size,
      englishEnabled: this.ai.isEnabled(),
    };
  }

  private openQb() {
    return this.tasks.createQueryBuilder('t').where('t.hidden = 0 AND t.done = 0');
  }

  private async countByArea(qb: SelectQueryBuilder<PlannerTask>) {
    const rows = await qb.select('t.area', 'area').addSelect('COUNT(*)', 'n').groupBy('t.area').getRawMany();
    const out: Record<Area, number> = { WORK: 0, PERSONAL: 0 };
    for (const r of rows) out[r.area as Area] = Number(r.n);
    return { ...out, total: out.WORK + out.PERSONAL };
  }

  // ───────────────────────────── Categories ─────────────────────────────

  async addCategory(dto: CreateCategoryDto) {
    const max = await this.categories.maximum('sort');
    return this.categories.save(this.categories.create({ ...dto, name: dto.name.trim(), sort: (max ?? 0) + 1 }));
  }

  /** Moving a category to the other area takes its tasks, goals, notes and series along. */
  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const c = await this.categories.findOneBy({ id });
    if (!c) throw new NotFoundException('Category not found');
    Object.assign(c, dto);
    await this.categories.save(c);
    if (dto.area) {
      for (const repo of [this.tasks, this.goals, this.notes, this.recurrences] as Repository<any>[]) {
        await repo.update({ categoryId: id }, { area: dto.area });
      }
    }
    return c;
  }

  async deleteCategory(id: number) {
    for (const repo of [this.tasks, this.goals, this.notes, this.recurrences] as Repository<any>[]) {
      await repo.update({ categoryId: id }, { categoryId: null });
    }
    await this.categories.delete(id);
    return { ok: true };
  }

  private async validCategory(id: number | null | undefined, area: Area): Promise<number | null> {
    if (!id) return null;
    const c = await this.categories.findOneBy({ id });
    return c && c.area === area ? c.id : null;
  }

  // ───────────────────────────── Tasks: queries ─────────────────────────────

  private taskQb() {
    return this.tasks.createQueryBuilder('t').where('t.hidden = 0');
  }

  private orderDefault(qb: SelectQueryBuilder<PlannerTask>) {
    return qb
      .orderBy('t.done', 'ASC')
      .addOrderBy('t.priority', 'DESC')
      .addOrderBy('COALESCE(t.startTime, 100000)', 'ASC')
      .addOrderBy('t.sort', 'ASC')
      .addOrderBy('t.id', 'ASC');
  }

  private orderByDate(qb: SelectQueryBuilder<PlannerTask>) {
    return qb
      .orderBy('t.date IS NULL', 'ASC')
      .addOrderBy('t.date', 'ASC')
      .addOrderBy('t.priority', 'DESC')
      .addOrderBy('COALESCE(t.startTime, 100000)', 'ASC')
      .addOrderBy('t.sort', 'ASC')
      .addOrderBy('t.id', 'ASC');
  }

  private withArea(qb: SelectQueryBuilder<PlannerTask>, area?: Area) {
    if (area) qb.andWhere('t.area = :area', { area });
    return qb;
  }

  /** Adds the derived counts (checklist, attachments) to task rows. */
  private async decorate(rows: PlannerTask[]): Promise<TaskDto[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [cl, att] = await Promise.all([
      this.checklist
        .createQueryBuilder('c')
        .select('c.taskId', 'taskId')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(c.done)', 'done')
        .where('c.taskId IN (:...ids)', { ids })
        .groupBy('c.taskId')
        .getRawMany(),
      this.attachments
        .createQueryBuilder('a')
        .select('a.taskId', 'taskId')
        .addSelect('COUNT(*)', 'n')
        .where('a.taskId IN (:...ids)', { ids })
        .groupBy('a.taskId')
        .getRawMany(),
    ]);
    const clMap = new Map(cl.map((r) => [Number(r.taskId), r]));
    const attMap = new Map(att.map((r) => [Number(r.taskId), Number(r.n)]));
    const today = this.today();
    return rows.map((t) => ({
      ...t,
      tags: t.tags ?? [],
      checklistTotal: Number(clMap.get(t.id)?.total ?? 0),
      checklistDone: Number(clMap.get(t.id)?.done ?? 0),
      attachmentCount: attMap.get(t.id) ?? 0,
      isOverdue: !!t.date && !t.done && t.recurrenceId === null && t.date < today,
      englishPending: this.pendingEnglish.has(`task:${t.id}`),
    }));
  }

  async listTasks(q: {
    view: TaskView;
    area?: Area;
    categoryId?: number;
    goalId?: number;
    q?: string;
    anchor?: string;
  }) {
    const today = this.today();
    const anchor = q.anchor || today;
    let qb = this.taskQb();
    let goals: GoalDto[] = [];
    let range: { from: string; to: string } | undefined;
    switch (q.view) {
      case 'today':
        await this.ensureRecurring([today]);
        qb = this.orderDefault(this.withArea(qb.andWhere('t.date = :today', { today }), q.area));
        break;
      case 'week':
      case 'month': {
        const from = q.view === 'week' ? startOfWeek(anchor) : startOfMonth(anchor);
        const to = q.view === 'week' ? addDays(from, 6) : endOfMonth(anchor);
        range = { from, to };
        await this.ensureRecurring(keysBetween(from, to));
        qb = this.withArea(qb.andWhere('t.date BETWEEN :from AND :to', { from, to }), q.area);
        qb = this.orderByDate(qb);
        goals = await this.goalsFor(q.view, from, q.area);
        break;
      }
      case 'all':
        qb = this.orderByDate(this.withArea(qb.andWhere('t.done = 0'), q.area));
        break;
      case 'backlog':
        qb = this.withArea(qb.andWhere('t.done = 0 AND t.date IS NULL'), q.area)
          .orderBy('t.priority', 'DESC')
          .addOrderBy('t.sort', 'ASC')
          .addOrderBy('t.id', 'ASC');
        break;
      case 'overdue':
        qb = this.withArea(
          qb.andWhere('t.done = 0 AND t.recurrenceId IS NULL AND t.date < :today', { today }),
          q.area,
        )
          .orderBy('t.date', 'ASC')
          .addOrderBy('t.area', 'ASC')
          .addOrderBy('t.priority', 'DESC')
          .addOrderBy('t.id', 'ASC');
        break;
      case 'category':
        qb = qb
          .andWhere('t.categoryId = :cid', { cid: q.categoryId ?? 0 })
          .andWhere('(t.done = 0 OR t.date >= :since)', { since: addDays(today, -7) })
          .orderBy('t.done', 'ASC')
          .addOrderBy('t.date IS NULL', 'ASC')
          .addOrderBy('t.date', 'ASC')
          .addOrderBy('t.priority', 'DESC')
          .addOrderBy('t.id', 'ASC');
        break;
      case 'goal':
        qb = qb
          .andWhere('t.goalId = :gid', { gid: q.goalId ?? 0 })
          .orderBy('t.date IS NULL', 'ASC')
          .addOrderBy('t.date', 'ASC')
          .addOrderBy('t.sort', 'ASC')
          .addOrderBy('t.id', 'ASC');
        break;
      case 'search': {
        const like = `%${(q.q ?? '').trim()}%`;
        qb = qb
          .andWhere(
            new Brackets((w) =>
              w
                .where('t.title LIKE :like', { like })
                .orWhere('t.tags LIKE :like', { like })
                .orWhere('t.notes LIKE :like', { like })
                .orWhere('t.result LIKE :like', { like }),
            ),
          )
          .orderBy('t.done', 'ASC')
          .addOrderBy('t.date', 'DESC')
          .take(200);
        break;
      }
    }
    const tasks = await this.decorate(await qb.getMany());
    return { today, range, tasks, goals };
  }

  /** Kanban: Backlog = open & not started (future recurring instances excluded); Done = last 7 days. */
  async board(area: Area) {
    const today = this.today();
    await this.ensureRecurring([today]);
    const open = await this.orderByDate(
      this.withArea(
        this.taskQb().andWhere(
          't.done = 0 AND (t.inProgress = 1 OR t.date IS NULL OR t.date <= :today OR t.recurrenceId IS NULL)',
          { today },
        ),
        area,
      ),
    ).getMany();
    const since = new Date(Date.now() - 7 * 86_400_000);
    const done = await this.withArea(this.taskQb().andWhere('t.done = 1 AND t.doneAt >= :since', { since }), area)
      .orderBy('t.doneAt', 'DESC')
      .take(100)
      .getMany();
    const [o, d] = await Promise.all([this.decorate(open), this.decorate(done)]);
    return {
      today,
      backlog: o.filter((t) => !t.inProgress),
      doing: o.filter((t) => t.inProgress),
      done: d,
    };
  }

  async getTask(id: number) {
    const t = await this.tasks.findOneBy({ id });
    if (!t || t.hidden) throw new NotFoundException('Task not found');
    const [dto] = await this.decorate([t]);
    const [checklist, attachments, recurrence, correction] = await Promise.all([
      this.checklist.find({ where: { taskId: id }, order: { sort: 'ASC', id: 'ASC' } }),
      this.attachments.find({ where: { taskId: id }, order: { id: 'ASC' } }),
      t.recurrenceId ? this.recurrences.findOneBy({ id: t.recurrenceId }) : null,
      this.activeCorrection('task', id, t.title),
    ]);
    const checklistPending = checklist.filter((c) => this.pendingEnglish.has(`checklist:${c.id}`)).map((c) => c.id);
    return { ...dto, checklist, attachments, recurrence, correction, checklistPending };
  }

  // ───────────────────────────── Tasks: mutations ─────────────────────────────

  async addTask(dto: CreateTaskDto) {
    const e = parseQuickEntry(dto.title);
    const title = e.title.trim();
    if (!title) throw new NotFoundException('Empty title');
    const max = await this.tasks.maximum('sort');
    let date = dto.date ?? null;
    if (dto.inProgress && !date) date = this.today();
    let goalId = dto.goalId ?? null;
    if (goalId) {
      const g = await this.goals.findOneBy({ id: goalId });
      if (!g || g.area !== dto.area) goalId = null;
    }
    const t = await this.tasks.save(
      this.tasks.create({
        title,
        date,
        area: dto.area,
        categoryId: await this.validCategory(dto.categoryId, dto.area),
        priority: e.priority,
        startTime: e.startTime,
        tags: e.tags,
        goalId,
        inProgress: !!dto.inProgress,
        notes: dto.notes ?? null,
        sort: (max ?? 0) + 1,
      }),
    );
    this.autoCheck('task', t.id, title);
    return (await this.decorate([t]))[0];
  }

  async updateTask(id: number, dto: UpdateTaskDto) {
    const t = await this.tasks.findOneBy({ id });
    if (!t || t.hidden) throw new NotFoundException('Task not found');
    const oldTitle = t.title;

    if (dto.date !== undefined && dto.date !== t.date) this.shiftDate(t, dto.date);
    if (dto.done !== undefined && dto.done !== t.done) this.applyDone(t, dto.done);
    if (dto.area && dto.area !== t.area) {
      t.area = dto.area;
      t.categoryId = await this.validCategory(t.categoryId, dto.area);
      if (t.goalId) {
        const g = await this.goals.findOneBy({ id: t.goalId });
        if (!g || g.area !== dto.area) t.goalId = null;
      }
    }
    if (dto.categoryId !== undefined) t.categoryId = await this.validCategory(dto.categoryId, t.area);
    if (dto.goalId !== undefined) t.goalId = dto.goalId;
    for (const k of ['priority', 'startTime', 'duration', 'notes', 'result', 'inProgress'] as const) {
      if (dto[k] !== undefined) (t as any)[k] = dto[k];
    }
    if (dto.tags !== undefined) t.tags = dto.tags.map((s) => s.replace(/^#/, '').trim()).filter(Boolean);
    if (dto.title !== undefined && dto.title.trim()) t.title = dto.title.trim();
    if (dto.reminderAt !== undefined) {
      t.reminderAt = dto.reminderAt ? new Date(dto.reminderAt) : null;
      t.reminded = false;
    }
    if (t.done) t.inProgress = false;

    await this.saveTask(t);
    if (t.title !== oldTitle) this.autoCheck('task', t.id, t.title);
    return this.getTask(id);
  }

  /** Saves a task; a recurring instance also updates its series template and future instances. */
  private async saveTask(t: PlannerTask) {
    await this.tasks.save(t);
    if (t.recurrenceId) await this.propagateTemplate(t);
  }

  private shiftDate(t: PlannerTask, newDate: string | null) {
    if (t.reminderAt && t.date && newDate) {
      t.reminderAt = new Date(t.reminderAt.getTime() + daysBetween(t.date, newDate) * 86_400_000);
      t.reminded = false;
    }
    t.date = newDate;
  }

  private applyDone(t: PlannerTask, done: boolean) {
    t.done = done;
    t.doneAt = done ? new Date() : null;
    if (done) {
      t.inProgress = false;
      // Finishing a backlog task counts it as today's work.
      if (!t.date) t.date = this.today();
    }
  }

  /** Applies a kanban drop. Backlog only clears the status (dates stay); starting a task dates it today. */
  async moveToColumn(id: number, column: BoardColumn) {
    const t = await this.tasks.findOneBy({ id });
    if (!t || t.hidden) throw new NotFoundException('Task not found');
    const today = this.today();
    if (column === 'done') {
      if (!t.done) this.applyDone(t, true);
    } else {
      if (column === 'doing' && (!t.date || (t.date > today && !t.recurrenceId))) this.shiftDate(t, today);
      t.inProgress = column === 'doing';
      if (t.done) {
        t.done = false;
        t.doneAt = null;
      }
    }
    await this.saveTask(t);
    return { ok: true };
  }

  async moveOverdueToToday(area?: Area) {
    const today = this.today();
    const rows = await this.withArea(
      this.taskQb().andWhere('t.done = 0 AND t.recurrenceId IS NULL AND t.date < :today', { today }),
      area,
    ).getMany();
    for (const t of rows) {
      this.shiftDate(t, today);
      await this.tasks.save(t);
    }
    return { moved: rows.length };
  }

  async deleteTask(id: number) {
    const t = await this.tasks.findOneBy({ id });
    if (!t) return { ok: true };
    if (t.recurrenceId) {
      // Keep the row hidden so the series doesn't regenerate this day.
      await this.tasks.update(id, { hidden: true });
    } else {
      await this.checklist.delete({ taskId: id });
      await this.attachments.delete({ taskId: id });
      await this.tasks.delete(id);
    }
    return { ok: true };
  }

  // ───────────────────────────── Checklist & attachments ─────────────────────────────

  async addChecklistItem(taskId: number, title: string) {
    const t = title.trim();
    if (!t) return null;
    const max = await this.checklist.maximum('sort', { taskId });
    const item = await this.checklist.save(this.checklist.create({ taskId, title: t, sort: (max ?? 0) + 1 }));
    this.autoCheck('checklist', item.id, t);
    return item;
  }

  async updateChecklistItem(id: number, dto: { title?: string; done?: boolean }) {
    const item = await this.checklist.findOneBy({ id });
    if (!item) throw new NotFoundException('Checklist item not found');
    const renamed = dto.title !== undefined && dto.title.trim() && dto.title.trim() !== item.title;
    if (dto.title !== undefined && dto.title.trim()) item.title = dto.title.trim();
    if (dto.done !== undefined) item.done = dto.done;
    await this.checklist.save(item);
    if (renamed) this.autoCheck('checklist', id, item.title);
    return item;
  }

  async deleteChecklistItem(id: number) {
    await this.checklist.delete(id);
    return { ok: true };
  }

  async addAttachment(taskId: number, dto: AttachmentCreateDto) {
    let v = dto.value.trim();
    if (!v) return null;
    let title = dto.title?.trim() || v;
    if (dto.kind === 'link') {
      if (!v.includes('://')) v = 'https://' + v;
      if (!dto.title) {
        try {
          const u = new URL(v);
          title = u.host + (u.pathname === '/' ? '' : u.pathname);
        } catch {
          title = v;
        }
      }
    }
    return this.attachments.save(this.attachments.create({ taskId, kind: dto.kind, title, value: v }));
  }

  async deleteAttachment(id: number) {
    await this.attachments.delete(id);
    return { ok: true };
  }

  // ───────────────────────────── Recurrence ─────────────────────────────

  private matches(r: PlannerRecurrence, day: string): boolean {
    const wd = weekday(day);
    switch (r.kind) {
      case 'daily':
        return true;
      case 'weekdays':
        return wd >= 1 && wd <= 5;
      case 'weekly':
        return (r.weekdays & (1 << wd)) !== 0;
      case 'monthly':
        return Number(day.slice(8, 10)) === Math.min(r.monthDay, daysInMonth(day));
    }
  }

  /** Materializes recurring instances for the given days (today onward only). */
  async ensureRecurring(days: string[]) {
    const today = this.today();
    const pending = days.filter((d) => d >= today && !this.ensured.has(d));
    if (!pending.length) return;
    const recs = await this.recurrences.find();
    const rows: Partial<PlannerTask>[] = [];
    for (const day of pending) {
      for (const r of recs) {
        if (day < r.startDate || (r.endDate && day > r.endDate) || !this.matches(r, day)) continue;
        rows.push({
          title: r.title,
          date: day,
          area: r.area,
          categoryId: r.categoryId,
          priority: r.priority,
          startTime: r.startTime,
          duration: r.duration,
          tags: r.tags ?? [],
          reminderAt: r.reminderTime != null ? atMinutes(day, r.reminderTime, this.tz) : null,
          goalId: r.goalId,
          recurrenceId: r.id,
          sort: 0,
        });
      }
    }
    if (rows.length) {
      await this.tasks.createQueryBuilder().insert().into(PlannerTask).values(rows).orIgnore().updateEntity(false).execute();
    }
    for (const d of pending) this.ensured.add(d);
  }

  private async propagateTemplate(t: PlannerTask) {
    const rid = t.recurrenceId!;
    const reminderTime = t.reminderAt ? minutesOf(t.reminderAt, this.tz) : null;
    const tpl = {
      title: t.title,
      area: t.area,
      categoryId: t.categoryId,
      priority: t.priority,
      startTime: t.startTime,
      duration: t.duration,
      tags: t.tags ?? [],
      goalId: t.goalId,
    };
    await this.recurrences.update(rid, { ...tpl, reminderTime });
    if (!t.date) return;
    const future = await this.tasks
      .createQueryBuilder('t')
      .where('t.recurrenceId = :rid AND t.date > :day AND t.done = 0 AND t.id != :id', { rid, day: t.date, id: t.id })
      .getMany();
    for (const f of future) {
      Object.assign(f, tpl);
      f.reminderAt = reminderTime != null ? atMinutes(f.date!, reminderTime, this.tz) : null;
      f.reminded = false;
      await this.tasks.save(f);
    }
  }

  /** kind == null stops the series (keeps past instances). */
  async setRecurrence(id: number, dto: RecurrenceDto) {
    const t = await this.tasks.findOneBy({ id });
    if (!t || t.hidden) throw new NotFoundException('Task not found');
    const day = t.date ?? this.today();
    t.date = day;
    const weekdays = dto.weekdays ?? 0;
    const monthDay = dto.monthDay ?? Number(day.slice(8, 10));
    if (dto.kind) {
      if (t.recurrenceId) {
        await this.recurrences.update(t.recurrenceId, { kind: dto.kind, weekdays, monthDay, endDate: null });
        await this.deleteFutureInstances(t.recurrenceId, day, t.id);
      } else {
        const r = await this.recurrences.save(
          this.recurrences.create({ kind: dto.kind, weekdays, monthDay, startDate: day, title: t.title, area: t.area }),
        );
        t.recurrenceId = r.id;
      }
    } else if (t.recurrenceId) {
      // The series ends the day before: this task leaves it, so `day` must not regenerate.
      await this.recurrences.update(t.recurrenceId, { endDate: addDays(day, -1) });
      await this.deleteFutureInstances(t.recurrenceId, day, t.id);
      t.recurrenceId = null;
    }
    this.ensured.clear();
    await this.saveTask(t);
    return this.getTask(id);
  }

  private async deleteFutureInstances(rid: number, after: string, except: number) {
    await this.tasks
      .createQueryBuilder()
      .delete()
      .from(PlannerTask)
      .where('recurrenceId = :rid AND date > :after AND done = 0 AND id != :except', { rid, after, except })
      .execute();
  }

  // ───────────────────────────── Goals ─────────────────────────────

  private async withProgress(goals: PlannerGoal[]): Promise<GoalDto[]> {
    if (!goals.length) return [];
    const rows = await this.tasks
      .createQueryBuilder('t')
      .select('t.goalId', 'goalId')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(t.done)', 'done')
      .where('t.hidden = 0 AND t.goalId IN (:...ids)', { ids: goals.map((g) => g.id) })
      .groupBy('t.goalId')
      .getRawMany();
    const m = new Map(rows.map((r) => [Number(r.goalId), r]));
    return goals.map((g) => ({
      ...g,
      progressDone: Number(m.get(g.id)?.done ?? 0),
      progressTotal: Number(m.get(g.id)?.total ?? 0),
    }));
  }

  private async goalsFor(period: GoalPeriod, start: string, area?: Area) {
    return this.withProgress(
      await this.goals.find({
        where: { period, periodStart: start, ...(area ? { area } : {}) },
        order: { done: 'ASC', id: 'ASC' },
      }),
    );
  }

  async listGoals(area?: Area, openOnly = false) {
    return this.withProgress(
      await this.goals.find({
        where: { ...(area ? { area } : {}), ...(openOnly ? { done: false } : {}) },
        order: { done: 'ASC', periodStart: 'DESC', id: 'ASC' },
      }),
    );
  }

  async getGoal(id: number) {
    const g = await this.goals.findOneBy({ id });
    if (!g) throw new NotFoundException('Goal not found');
    const [dto] = await this.withProgress([g]);
    const { tasks } = await this.listTasks({ view: 'goal', goalId: id });
    return { ...dto, tasks, correction: await this.activeCorrection('goal', id, g.title) };
  }

  async addGoal(dto: CreateGoalDto) {
    const g = await this.goals.save(
      this.goals.create({ ...dto, title: dto.title.trim(), categoryId: await this.validCategory(dto.categoryId, dto.area) }),
    );
    this.autoCheck('goal', g.id, g.title);
    return g;
  }

  async updateGoal(id: number, dto: UpdateGoalDto) {
    const g = await this.goals.findOneBy({ id });
    if (!g) throw new NotFoundException('Goal not found');
    const oldTitle = g.title;
    if (dto.title !== undefined && dto.title.trim()) g.title = dto.title.trim();
    if (dto.categoryId !== undefined) g.categoryId = await this.validCategory(dto.categoryId, g.area);
    for (const k of ['period', 'periodStart', 'notes', 'done'] as const) {
      if (dto[k] !== undefined) (g as any)[k] = dto[k];
    }
    await this.goals.save(g);
    if (g.title !== oldTitle) this.autoCheck('goal', id, g.title);
    return this.getGoal(id);
  }

  async deleteGoal(id: number) {
    await this.tasks.update({ goalId: id }, { goalId: null });
    await this.recurrences.update({ goalId: id }, { goalId: null });
    await this.goals.delete(id);
    return { ok: true };
  }

  // ───────────────────────────── Notes ─────────────────────────────

  async listNotes(area: Area | undefined, filter: 'all' | 'ideas' | 'daily', q?: string) {
    const qb = this.notes.createQueryBuilder('n').where('1 = 1');
    if (area) qb.andWhere('n.area = :area', { area });
    if (filter === 'ideas') qb.andWhere('n.day IS NULL');
    if (filter === 'daily') qb.andWhere('n.day IS NOT NULL');
    const s = (q ?? '').trim();
    if (s) qb.andWhere('(n.title LIKE :s OR n.body LIKE :s)', { s: `%${s}%` });
    return qb.orderBy('n.pinned', 'DESC').addOrderBy('n.updatedAt', 'DESC').getMany();
  }

  async getNote(id: number) {
    const n = await this.notes.findOneBy({ id });
    if (!n) throw new NotFoundException('Note not found');
    return {
      ...n,
      correction: await this.activeCorrection('noteTitle', id, n.title),
      englishPending: this.pendingEnglish.has(`noteTitle:${id}`),
    };
  }

  async addNote(dto: CreateNoteDto) {
    const n = await this.notes.save(
      this.notes.create({
        area: dto.area,
        title: dto.title?.trim() ?? '',
        body: dto.body ?? '',
        categoryId: await this.validCategory(dto.categoryId, dto.area),
      }),
    );
    if (n.title) this.autoCheck('noteTitle', n.id, n.title);
    return n;
  }

  async updateNote(id: number, dto: UpdateNoteDto) {
    const n = await this.notes.findOneBy({ id });
    if (!n) throw new NotFoundException('Note not found');
    const oldTitle = n.title;
    if (dto.title !== undefined) n.title = dto.title.trim();
    if (dto.body !== undefined) n.body = dto.body;
    if (dto.pinned !== undefined) n.pinned = dto.pinned;
    // Day notes are unique per (day, area), so they keep their area.
    if (dto.area && !n.day) n.area = dto.area;
    if (dto.categoryId !== undefined || dto.area) {
      n.categoryId = await this.validCategory(dto.categoryId !== undefined ? dto.categoryId : n.categoryId, n.area);
    }
    await this.notes.save(n);
    if (n.title && n.title !== oldTitle) this.autoCheck('noteTitle', id, n.title);
    return this.getNote(id);
  }

  async deleteNote(id: number) {
    await this.notes.delete(id);
    return { ok: true };
  }

  async dayNote(day: string, area: Area) {
    return (await this.notes.findOneBy({ day, area })) ?? null;
  }

  async saveDayNote(day: string, area: Area, body: string) {
    const n = await this.notes.findOneBy({ day, area });
    if (n) {
      n.body = body;
      return this.notes.save(n);
    }
    if (!body.trim()) return null;
    return this.notes.save(this.notes.create({ day, area, body, title: '' }));
  }

  async noteToTask(id: number) {
    const n = await this.notes.findOneBy({ id });
    if (!n) throw new NotFoundException('Note not found');
    const firstLine = (n.body ?? '').split('\n').map((l) => l.replace(/^[#>*\-\s]+/, '').trim()).find(Boolean);
    const title = n.title.trim() || firstLine || 'Note';
    return this.addTask({
      title,
      date: this.today(),
      area: n.area,
      categoryId: n.categoryId,
      notes: n.body ?? '',
    });
  }

  // ───────────────────────────── Stats ─────────────────────────────

  async stats(from: string, to: string, period: GoalPeriod, area?: Area) {
    const qb = () => {
      const b = this.tasks.createQueryBuilder('t').where('t.hidden = 0 AND t.date BETWEEN :from AND :to', { from, to });
      if (area) b.andWhere('t.area = :area', { area });
      return b;
    };
    const [days, cats, overdue, goals] = await Promise.all([
      qb()
        .select('t.date', 'date')
        .addSelect('t.area', 'area')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(t.done)', 'done')
        .groupBy('t.date')
        .addGroupBy('t.area')
        .getRawMany(),
      qb()
        .select('t.area', 'area')
        .addSelect('t.categoryId', 'categoryId')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(t.done)', 'done')
        .groupBy('t.area')
        .addGroupBy('t.categoryId')
        .orderBy('t.area')
        .addOrderBy('total', 'DESC')
        .getRawMany(),
      this.countByArea(this.openQb().andWhere('t.recurrenceId IS NULL').andWhere('t.date < :today', { today: this.today() })),
      this.goalsFor(period, from, area),
    ]);
    const num = (r: any) => ({ total: Number(r.total), done: Number(r.done ?? 0) });
    return {
      from,
      to,
      days: days.map((r) => ({ date: r.date, area: r.area as Area, ...num(r) })),
      categories: cats.map((r) => ({
        area: r.area as Area,
        categoryId: r.categoryId == null ? null : Number(r.categoryId),
        ...num(r),
      })),
      overdue,
      goals,
    };
  }

  // ───────────────────────────── English auto-correct ─────────────────────────────

  private static worthChecking(s: string) {
    const t = s.trim();
    return t.length >= 3 && /\p{L}/u.test(t);
  }

  /** Fire-and-forget: correct a short field in the background and log what changed. */
  private autoCheck(kind: Exclude<CorrectionKind, 'text'>, id: number, text: string) {
    if (!this.ai.isEnabled() || !PlannerService.worthChecking(text)) return;
    const key = `${kind}:${id}`;
    this.pendingEnglish.add(key);
    this.ai
      .correctEnglish(text)
      .then(async (fix) => {
        const fixed = fix.text.trim();
        if (!fixed || fixed === text.trim()) return;
        if (await this.applyCorrection(kind, id, text, fixed)) {
          await this.corrections.save(
            this.corrections.create({ kind, refId: id, original: text, corrected: fixed, why: fix.why ?? '' }),
          );
        }
      })
      .catch((e) => this.logger.warn(`English check ${key} failed: ${e.message}`))
      .finally(() => this.pendingEnglish.delete(key));
  }

  /** Writes `value` into a field only if it still holds `expected`. Returns whether it did. */
  private async applyCorrection(kind: CorrectionKind, id: number, expected: string, value: string) {
    let res;
    switch (kind) {
      case 'task': {
        const t = await this.tasks.findOneBy({ id });
        if (!t || t.title !== expected) return false;
        t.title = value;
        await this.saveTask(t);
        return true;
      }
      case 'checklist':
        res = await this.checklist.update({ id, title: expected }, { title: value });
        break;
      case 'goal':
        res = await this.goals.update({ id, title: expected }, { title: value });
        break;
      case 'noteTitle':
        res = await this.notes.update({ id, title: expected }, { title: value });
        break;
      case 'text':
        res = await this.notes.update({ id, body: expected }, { body: value });
        break;
    }
    return (res?.affected ?? 0) > 0;
  }

  private async currentText(kind: CorrectionKind, id: number): Promise<string | null> {
    switch (kind) {
      case 'task':
        return (await this.tasks.findOneBy({ id }))?.title ?? null;
      case 'checklist':
        return (await this.checklist.findOneBy({ id }))?.title ?? null;
      case 'goal':
        return (await this.goals.findOneBy({ id }))?.title ?? null;
      case 'noteTitle':
        return (await this.notes.findOneBy({ id }))?.title ?? null;
      case 'text':
        return (await this.notes.findOneBy({ id }))?.body ?? null;
    }
  }

  /** Latest correction of a field, if the field still holds the corrected text. */
  private async activeCorrection(kind: CorrectionKind, refId: number, current: string) {
    const c = await this.corrections.findOne({ where: { kind, refId }, order: { id: 'DESC' } });
    return c && c.corrected === current ? c : null;
  }

  /** Corrects a note body on demand ("Check English"); applies it if the note still holds `text`. */
  async checkText(text: string, noteId?: number) {
    if (!this.ai.isEnabled()) return { text, why: '', changed: false, enabled: false };
    const fix = await this.ai.correctEnglish(text);
    const changed = !!fix.text.trim() && fix.text.trim() !== text.trim();
    if (changed && noteId && (await this.applyCorrection('text', noteId, text, fix.text))) {
      await this.corrections.save(
        this.corrections.create({ kind: 'text', refId: noteId, original: text, corrected: fix.text, why: fix.why }),
      );
    }
    return { text: changed ? fix.text : text, why: fix.why, changed, enabled: true };
  }

  async listCorrections(limit = 300) {
    const rows = await this.corrections.find({ order: { createdAt: 'DESC', id: 'DESC' }, take: limit });
    return Promise.all(
      rows.map(async (c) => ({ ...c, canRevert: (await this.currentText(c.kind, c.refId)) === c.corrected })),
    );
  }

  async revertCorrection(id: number) {
    const c = await this.corrections.findOneBy({ id });
    if (!c) throw new NotFoundException('Correction not found');
    if (!(await this.applyCorrection(c.kind, c.refId, c.corrected, c.original))) {
      return { ok: false, reason: 'The text was edited since the correction' };
    }
    await this.corrections.delete(id);
    return { ok: true };
  }

  async deleteCorrection(id: number) {
    await this.corrections.delete(id);
    return { ok: true };
  }

  async clearCorrections() {
    await this.corrections.clear();
    return { ok: true };
  }

  // ───────────────────────────── Reminders (used by the cron) ─────────────────────────────

  /** Tasks whose reminder time has come and that haven't been announced yet (last 24h only). */
  async dueReminders() {
    const now = new Date();
    await this.ensureRecurring([this.today(), addDays(this.today(), 1)]);
    return this.tasks.find({
      where: {
        hidden: false,
        done: false,
        reminded: false,
        reminderAt: LessThanOrEqual(now),
      },
      order: { reminderAt: 'ASC' },
      take: 50,
    }).then((rows) => rows.filter((t) => t.reminderAt && now.getTime() - t.reminderAt.getTime() < 86_400_000));
  }

  async markReminded(ids: number[]) {
    if (ids.length) await this.tasks.update({ id: In(ids) }, { reminded: true });
  }

  categoryName(id: number | null, cats: PlannerCategory[]) {
    return cats.find((c) => c.id === id)?.name ?? null;
  }

  async allCategories() {
    return this.categories.find();
  }

  static areas = AREAS;
}
