import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CourseAiService } from '../ai/course-ai.service';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';
import { CourseLesson, LessonStatus } from './entities/course-lesson.entity';
import { CourseUnit } from './entities/course-unit.entity';
import { frameworkFor, syllabusPoint } from './syllabus';

/** Lessons written at the same time while a level is generated. */
const CONCURRENCY = 3;
/** Tries per lesson before it is marked FAILED (a later run retries it). */
const TRIES = 2;

/**
 * Builds a level's content in the background: the outline (units + lesson
 * plans) first, then every lesson that has no content yet. Safe to start
 * again at any time — it only fills in what is missing or failed.
 */
@Injectable()
export class CourseGeneratorService implements OnModuleInit {
  private readonly logger = new Logger(CourseGeneratorService.name);
  private readonly running = new Set<CefrLevel>();
  /** Last outline failure per level, shown on the dashboard. */
  private readonly outlineErrors = new Map<CefrLevel, string>();

  constructor(
    @InjectRepository(CourseUnit) private readonly units: Repository<CourseUnit>,
    @InjectRepository(CourseLesson) private readonly lessons: Repository<CourseLesson>,
    private readonly ai: CourseAiService,
  ) {}

  /** A restart kills in-flight jobs: put their lessons back in the queue. */
  async onModuleInit() {
    await this.lessons.update({ status: LessonStatus.GENERATING }, { status: LessonStatus.PENDING });
  }

  isRunning(level: CefrLevel): boolean {
    return this.running.has(level);
  }

  outlineError(level: CefrLevel): string | null {
    return this.outlineErrors.get(level) ?? null;
  }

  /** Start (or resume) generating a level. Returns false if it is already running. */
  start(level: CefrLevel): { started: boolean; enabled: boolean } {
    if (!this.ai.isEnabled()) return { started: false, enabled: false };
    if (this.running.has(level)) return { started: false, enabled: true };
    this.running.add(level);
    this.outlineErrors.delete(level);
    void this.run(level)
      .catch((e) => {
        this.logger.error(`${level}: generation stopped — ${e.message}`);
        this.outlineErrors.set(level, e.message);
      })
      .finally(() => this.running.delete(level));
    return { started: true, enabled: true };
  }

  /** Rewrite one lesson's content (in the background). Progress is kept. */
  async regenerate(id: string): Promise<CourseLesson> {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);
    if (lesson.status === LessonStatus.GENERATING) return lesson;
    lesson.status = LessonStatus.GENERATING;
    lesson.error = null;
    await this.lessons.save(lesson);
    void this.writeLesson(lesson.id);
    return lesson;
  }

  private async run(level: CefrLevel) {
    if (!(await this.units.count({ where: { level } }))) await this.writeOutline(level);

    await this.lessons.update(
      { level, status: In([LessonStatus.FAILED, LessonStatus.GENERATING]) },
      { status: LessonStatus.PENDING },
    );
    const queue = await this.orderedLessons(level, LessonStatus.PENDING);
    this.logger.log(`${level}: writing ${queue.length} lessons`);
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await this.writeLesson(next.id);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    this.logger.log(`${level}: done`);
  }

  private async writeOutline(level: CefrLevel) {
    this.logger.log(`${level}: writing the outline`);
    const outline = await this.ai.generateOutline(level);
    const covered = new Set(outline.units.flatMap((u) => u.lessons.flatMap((l) => l.syllabusKeys ?? [])));
    const missing = (frameworkFor(level)?.points ?? []).filter((p) => !covered.has(p.key));
    if (missing.length) {
      this.logger.warn(`${level}: outline leaves out ${missing.map((p) => p.key).join(', ')}`);
    }
    for (const [u, unitPlan] of outline.units.entries()) {
      const unit = await this.units.save(
        this.units.create({
          level,
          position: u + 1,
          title: unitPlan.title,
          titleVi: unitPlan.titleVi,
          summary: unitPlan.summary,
        }),
      );
      await this.lessons.save(
        unitPlan.lessons.map((l, i) =>
          this.lessons.create({
            unitId: unit.id,
            level,
            position: i + 1,
            title: l.title,
            grammar: l.grammar,
            vocabTheme: l.vocabTheme,
            objective: l.objective,
            syllabusKeys: l.syllabusKeys ?? [],
            status: LessonStatus.PENDING,
          }),
        ),
      );
    }
  }

  /** Lessons of a level in study order (unit, then lesson). */
  private async orderedLessons(level: CefrLevel, status?: LessonStatus) {
    const units = await this.units.find({ where: { level }, order: { position: 'ASC' } });
    const unitPos = new Map(units.map((u) => [u.id, u.position]));
    const rows = await this.lessons.find({ where: status ? { level, status } : { level } });
    return rows.sort(
      (a, b) => unitPos.get(a.unitId)! - unitPos.get(b.unitId)! || a.position - b.position,
    );
  }

  private async writeLesson(id: string) {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson) return;
    const unit = await this.units.findOne({ where: { id: lesson.unitId } });
    const siblings = await this.lessons.find({ where: { level: lesson.level } });
    await this.lessons.update(id, { status: LessonStatus.GENERATING, error: null });

    let lastError = '';
    for (let attempt = 1; attempt <= TRIES; attempt++) {
      try {
        const content = await this.ai.generateLesson({
          level: lesson.level,
          unitTitle: unit?.title ?? '',
          unitSummary: unit?.summary ?? '',
          title: lesson.title,
          grammar: lesson.grammar,
          vocabTheme: lesson.vocabTheme,
          objective: lesson.objective,
          syllabus: (lesson.syllabusKeys ?? [])
            .map((k) => syllabusPoint(k)?.name)
            .filter((n): n is string => !!n),
          otherGrammar: siblings.filter((s) => s.id !== id).map((s) => s.grammar),
        });
        await this.lessons.update(id, {
          ...content,
          status: LessonStatus.READY,
          error: null,
          generatedAt: new Date(),
        });
        this.logger.log(`lesson "${lesson.title}" ready (${content.exercises.length} exercises)`);
        return;
      } catch (e) {
        lastError = e.message;
        this.logger.warn(`lesson "${lesson.title}" try ${attempt} failed: ${e.message}`);
      }
    }
    await this.lessons.update(id, { status: LessonStatus.FAILED, error: lastError.slice(0, 1000) });
  }
}
