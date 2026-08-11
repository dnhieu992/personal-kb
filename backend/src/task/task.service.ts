import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, LessThan, Not, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { EnglishCoachService } from '../english/english-coach.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  CoachStatus,
  Task,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from './entities/task.entity';

/** One day's plan: what is scheduled, plus what was left unfinished before it. */
export interface DayPlan {
  date: string;
  tasks: Task[];
  /** Unfinished tasks planned for an earlier day — still hanging over you. */
  carriedOver: Task[];
  total: number;
  done: number;
}

export interface TaskFilters {
  date?: string;
  category?: TaskCategory;
  status?: TaskStatus;
  listId?: string;
  /** true = only backlog tasks (no plan date) */
  unplanned?: boolean;
}

/** Sort keys: what you are doing now first, then what is most urgent. */
const STATUS_RANK: Record<TaskStatus, number> = {
  [TaskStatus.IN_PROGRESS]: 0,
  [TaskStatus.TODO]: 1,
  [TaskStatus.DONE]: 2,
};

const PRIORITY_RANK: Record<TaskPriority, number> = {
  [TaskPriority.URGENT]: 0,
  [TaskPriority.HIGH]: 1,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.LOW]: 3,
};

/** Local YYYY-MM-DD for a date. Never toISOString() — UTC rolls over at 7am ICT. */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today in the server's timezone. Clients should send their own date instead. */
export const todayIso = (): string => isoDate(new Date());

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(Task)
    private readonly repo: Repository<Task>,
    private readonly ai: AiService,
    private readonly english: EnglishCoachService,
  ) {}

  /**
   * Save the task immediately and hand it back — the English pass runs in the
   * background so adding ten tasks in a row doesn't mean ten AI round-trips of
   * waiting. Clients watch `coachStatus` to know when the wording settles.
   */
  async create(dto: CreateTaskDto): Promise<Task> {
    // Without an API key nothing would be corrected, so say so rather than
    // reporting a coaching pass that never happened.
    const autoCoach = dto.autoCoach !== false && this.ai.isEnabled();
    const status = dto.status ?? TaskStatus.TODO;
    const rawTitle = dto.title.trim().slice(0, 255);
    const rawNotes = dto.notes?.trim() || null;
    const task = await this.repo.save(
      this.repo.create({
        title: rawTitle,
        notes: rawNotes,
        // Stamped up front so the background pass can tell whether the row it
        // comes back to is still the text it was asked to correct. The pass
        // clears them again if the AI changed nothing.
        originalTitle: autoCoach ? rawTitle : null,
        originalNotes: autoCoach ? rawNotes : null,
        status,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        category: dto.category ?? TaskCategory.COMPANY,
        planDate: dto.planDate ?? null,
        dueDate: dto.dueDate ?? null,
        listId: dto.listId ?? null,
        completedAt: status === TaskStatus.DONE ? new Date() : null,
        coachStatus: autoCoach ? CoachStatus.PENDING : CoachStatus.SKIPPED,
      }),
    );
    if (autoCoach) this.coachLater(task.id, rawTitle, rawNotes);
    return task;
  }

  /** List tasks, filtered. Newest-relevant ordering is applied in memory. */
  async findAll(filters: TaskFilters = {}): Promise<Task[]> {
    const where: FindOptionsWhere<Task> = {};
    if (filters.date) where.planDate = filters.date;
    if (filters.unplanned) where.planDate = IsNull();
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.listId) where.listId = filters.listId;
    return this.sort(await this.repo.find({ where }));
  }

  /**
   * The day view: everything planned for `date`, plus anything still open from
   * before it. Carry-over is the whole point of a daily plan — an unfinished
   * task should follow you until you either do it or move it.
   */
  async day(date = todayIso()): Promise<DayPlan> {
    const [tasks, carriedOver] = await Promise.all([
      this.repo.find({ where: { planDate: date } }),
      this.repo.find({
        where: {
          planDate: LessThan(date),
          status: Not(TaskStatus.DONE),
        },
      }),
    ]);
    return {
      date,
      tasks: this.sort(tasks),
      carriedOver: this.sort(carriedOver),
      total: tasks.length,
      done: tasks.filter((t) => t.status === TaskStatus.DONE).length,
    };
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  /**
   * Update a task. Touching the title or notes re-runs the English pass in the
   * background (unless the caller opted out), exactly like editing an entry.
   */
  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    const autoCoach = dto.autoCoach !== false && this.ai.isEnabled();

    const title =
      dto.title !== undefined ? dto.title.trim().slice(0, 255) : task.title;
    const notes =
      dto.notes !== undefined ? dto.notes?.trim() || null : task.notes;
    // Text counts as edited only when it matches neither what is stored nor
    // what the author typed before the AI corrected it — the editor pre-fills
    // with the latter, so saving it back untouched must not re-coach.
    const titleChanged =
      title !== task.title && title !== task.originalTitle;
    const notesChanged =
      notes !== task.notes && notes !== task.originalNotes;
    const textChanged = titleChanged || notesChanged;

    if (dto.status !== undefined) this.applyStatus(task, dto.status);

    Object.assign(task, {
      title,
      notes,
      priority: dto.priority ?? task.priority,
      category: dto.category ?? task.category,
      // undefined → leave as-is; null → clear.
      planDate: dto.planDate === undefined ? task.planDate : dto.planDate,
      dueDate: dto.dueDate === undefined ? task.dueDate : dto.dueDate,
      listId: dto.listId === undefined ? task.listId : dto.listId,
    });

    // Coach from the author's own words: whichever half they just rewrote, plus
    // the raw version of the half they left alone.
    const rawTitle = titleChanged ? title : task.originalTitle ?? task.title;
    const rawNotes = notesChanged ? notes : task.originalNotes ?? task.notes;

    if (textChanged) {
      task.originalTitle = autoCoach ? rawTitle : null;
      task.originalNotes = autoCoach ? rawNotes : null;
      task.coachStatus = autoCoach ? CoachStatus.PENDING : CoachStatus.SKIPPED;
    }

    const saved = await this.repo.save(task);
    if (textChanged && autoCoach) this.coachLater(saved.id, rawTitle, rawNotes);
    return saved;
  }

  /** Tick a task off (or un-tick it). Deliberately does no AI work. */
  async setStatus(id: string, status: TaskStatus): Promise<Task> {
    const task = await this.findOne(id);
    this.applyStatus(task, status);
    return this.repo.save(task);
  }

  /** Move a task to another day (or to the backlog with `null`). */
  async reschedule(id: string, planDate: string | null): Promise<Task> {
    const task = await this.findOne(id);
    task.planDate = planDate;
    return this.repo.save(task);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const task = await this.findOne(id);
    // The review cards collected from this task go with it, like an entry's do.
    await this.english.removeCollected(id);
    await this.repo.remove(task);
    return { deleted: true };
  }

  /** The review cards this task produced, for the "what did I get wrong" panel. */
  collected(id: string) {
    return this.english.collectedFor(id);
  }

  /**
   * Planner dashboard: today at a glance, the backlog/overdue pressure, and how
   * the last seven days went.
   */
  async stats(date = todayIso()) {
    const all = await this.repo.find();
    const today = all.filter((t) => t.planDate === date);
    const byCategory = Object.values(TaskCategory).reduce(
      (acc, c) => ({
        ...acc,
        [c]: {
          total: today.filter((t) => t.category === c).length,
          done: today.filter(
            (t) => t.category === c && t.status === TaskStatus.DONE,
          ).length,
        },
      }),
      {} as Record<TaskCategory, { total: number; done: number }>,
    );

    const weekly: { date: string; planned: number; done: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(`${date}T00:00:00`);
      day.setDate(day.getDate() - i);
      const iso = isoDate(day);
      const planned = all.filter((t) => t.planDate === iso);
      weekly.push({
        date: iso,
        planned: planned.length,
        done: planned.filter((t) => t.status === TaskStatus.DONE).length,
      });
    }

    const open = all.filter((t) => t.status !== TaskStatus.DONE);
    return {
      date,
      todayTotal: today.length,
      todayDone: today.filter((t) => t.status === TaskStatus.DONE).length,
      byCategory,
      backlog: open.filter((t) => !t.planDate).length,
      overdue: open.filter((t) => !!t.planDate && t.planDate < date).length,
      inProgress: all.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      weekly,
    };
  }

  // ---------------------------------------------------------------------------
  // English coaching
  // ---------------------------------------------------------------------------

  /**
   * Kick off the background pass. Deliberately not awaited: the HTTP response
   * has already gone out by the time this finishes, and nothing the user does
   * next depends on it.
   */
  private coachLater(
    id: string,
    rawTitle: string,
    rawNotes: string | null,
  ): void {
    void this.coach(id, rawTitle, rawNotes).catch(async (e) => {
      this.logger.error(`coach(${id}) failed: ${e.message}`);
      await this.repo
        .update({ id }, { coachStatus: CoachStatus.FAILED })
        .catch(() => undefined);
    });
  }

  /**
   * The same treatment a knowledge entry gets on save, applied to a task:
   * rewrite the notes as English Markdown, correct the title, and file the
   * grammar/vocabulary the author got wrong as review cards.
   */
  private async coach(
    id: string,
    rawTitle: string,
    rawNotes: string | null,
  ): Promise<void> {
    const typed = rawNotes?.trim()
      ? `${rawTitle}\n\n${rawNotes}`
      : rawTitle;
    const [formatted, review] = await Promise.all([
      rawNotes?.trim()
        ? this.ai.formatContent(rawNotes, rawTitle, 'TASK')
        : Promise.resolve<string | null>(null),
      this.english.review(rawTitle, typed),
    ]);

    const task = await this.repo.findOne({ where: { id } });
    // Deleted while we were waiting on the AI.
    if (!task) return;
    // Edited while we were waiting: the newer edit re-stamped what the author
    // typed and queued its own pass, so writing ours now would bring back the
    // old wording.
    if (task.originalTitle !== rawTitle || task.originalNotes !== rawNotes) {
      return;
    }

    const title = (review.title?.trim() || rawTitle).slice(0, 255);
    const notes = formatted ?? rawNotes;
    task.title = title;
    task.originalTitle = title === rawTitle ? null : rawTitle;
    task.notes = notes;
    task.originalNotes = !rawNotes || notes === rawNotes ? null : rawNotes;

    // Cards from an earlier wording are left alone: they carry review history,
    // and collect() dedupes by content so nothing is filed twice.
    const collected = await this.english.collect(review.items, id);
    task.collectedCount = collected.length;
    task.coachStatus = CoachStatus.DONE;
    await this.repo.save(task);
  }

  // ---------------------------------------------------------------------------

  /** Keep completedAt in step with the status. */
  private applyStatus(task: Task, status: TaskStatus): void {
    task.status = status;
    task.completedAt = status === TaskStatus.DONE ? new Date() : null;
  }

  /** In progress first, then by priority, then oldest first. Lists are small. */
  private sort(tasks: Task[]): Task[] {
    return tasks.sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
}
