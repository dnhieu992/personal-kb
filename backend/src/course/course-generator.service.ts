import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CourseAiService } from '../ai/course-ai.service';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';
import { COURSE_LEVELS, Exercise, UNITS_PER_LEVEL } from './course.types';
import { CourseLesson, LessonKind, LessonStatus } from './entities/course-lesson.entity';
import { CourseUnit } from './entities/course-unit.entity';
import { frameworkFor, syllabusPoint } from './syllabus';
import type { LevelOutline } from './course.types';

/** Lessons written at the same time while a level is generated. */
const CONCURRENCY = 3;
/** Tries per lesson before it is marked FAILED (a later run retries it). */
const TRIES = 2;
/** Exercises in a unit review. */
const REVIEW_SIZE = 15;

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
    // Reviews need no AI: build any that are due (e.g. after a deploy that added them).
    for (const level of COURSE_LEVELS) {
      await this.buildReviews(level).catch((e) => this.logger.warn(`${level} reviews: ${e.message}`));
    }
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
    if (lesson.kind === LessonKind.REVIEW) {
      lesson.exercises = await this.reviewExercises(lesson.unitId);
      return this.lessons.save(lesson);
    }
    lesson.status = LessonStatus.GENERATING;
    lesson.error = null;
    await this.lessons.save(lesson);
    void this.writeLesson(lesson.id);
    return lesson;
  }

  private async run(level: CefrLevel) {
    const unitCount = await this.units.count({ where: { level } });
    if (!unitCount) await this.writeOutline(level);
    else if (unitCount < UNITS_PER_LEVEL) await this.extendOutline(level);

    await this.lessons.update(
      { level, status: In([LessonStatus.FAILED, LessonStatus.GENERATING]) },
      { status: LessonStatus.PENDING },
    );
    const queue = (await this.orderedLessons(level, LessonStatus.PENDING)).filter(
      (l) => l.kind === LessonKind.LESSON,
    );
    this.logger.log(`${level}: writing ${queue.length} lessons`);
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await this.writeLesson(next.id);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await this.buildReviews(level);
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
    await this.saveUnits(level, outline.units, 0);
  }

  /** A level with fewer units than planned (older, smaller syllabus): add the rest. */
  private async extendOutline(level: CefrLevel) {
    const units = await this.units.find({ where: { level }, order: { position: 'ASC' } });
    const rows = await this.lessons.find({
      where: { level, kind: LessonKind.LESSON },
      select: ['unitId', 'position', 'grammar', 'syllabusKeys'],
    });
    const covered = new Set(rows.flatMap((l) => l.syllabusKeys ?? []));
    const uncovered = (frameworkFor(level)?.points ?? []).filter((p) => !covered.has(p.key)).map((p) => p.key);
    this.logger.log(`${level}: adding ${UNITS_PER_LEVEL - units.length} units`);
    const outline = await this.ai.generateOutline(level, {
      units: units.map((u) => ({
        title: u.title,
        grammar: rows
          .filter((l) => l.unitId === u.id)
          .sort((a, b) => a.position - b.position)
          .map((l) => l.grammar),
      })),
      uncovered,
    });
    await this.saveUnits(level, outline.units, units[units.length - 1]?.position ?? 0);
  }

  private async saveUnits(level: CefrLevel, plans: LevelOutline['units'], after: number) {
    for (const [u, unitPlan] of plans.entries()) {
      const unit = await this.units.save(
        this.units.create({
          level,
          position: after + u + 1,
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
    const siblings = await this.lessons.find({ where: { level: lesson.level, kind: LessonKind.LESSON } });
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
        await this.buildReview(lesson.unitId).catch((e) => this.logger.warn(`review: ${e.message}`));
        return;
      } catch (e) {
        lastError = e.message;
        this.logger.warn(`lesson "${lesson.title}" try ${attempt} failed: ${e.message}`);
      }
    }
    await this.lessons.update(id, { status: LessonStatus.FAILED, error: lastError.slice(0, 1000) });
  }

  /** Build the review of every unit of the level whose lessons are all written. */
  async buildReviews(level: CefrLevel) {
    const units = await this.units.find({ where: { level }, select: ['id'] });
    for (const u of units) await this.buildReview(u.id);
  }

  /**
   * A unit's last "lesson": a mixed test drawn from its lessons' exercises,
   * added once every lesson of the unit is READY. No AI involved.
   */
  private async buildReview(unitId: string) {
    const rows = await this.lessons.find({ where: { unitId } });
    const taught = rows.filter((l) => l.kind === LessonKind.LESSON);
    if (!taught.length || rows.some((l) => l.kind === LessonKind.REVIEW)) return;
    if (taught.some((l) => l.status !== LessonStatus.READY)) return;
    const unit = await this.units.findOne({ where: { id: unitId } });
    if (!unit) return;
    const keys = [...new Set(taught.flatMap((l) => l.syllabusKeys ?? []))];
    await this.lessons.save(
      this.lessons.create({
        unitId,
        level: unit.level,
        kind: LessonKind.REVIEW,
        position: Math.max(...rows.map((l) => l.position)) + 1,
        title: `Unit review: ${unit.title}`,
        grammar: taught.map((l) => l.grammar).join(' · ').slice(0, 255),
        vocabTheme: 'Ôn tập tổng hợp',
        objective: 'Sau bài này bạn có thể dùng chắc ngữ pháp và từ vựng của cả unit trong một bài trộn.',
        syllabusKeys: keys,
        status: LessonStatus.READY,
        exercises: await this.reviewExercises(unitId),
        minutes: 12,
        generatedAt: new Date(),
      }),
    ).catch((e) => {
      // Two workers finishing the same unit at once: the second insert loses, which is fine.
      if (!String(e.message).includes('Duplicate')) throw e;
    });
    this.logger.log(`unit "${unit.title}": review added`);
  }

  /** ~REVIEW_SIZE exercises, spread evenly over the unit's lessons, harder ones first. */
  private async reviewExercises(unitId: string): Promise<Exercise[]> {
    const taught = (await this.lessons.find({ where: { unitId, kind: LessonKind.LESSON } })).sort(
      (a, b) => a.position - b.position,
    );
    const per = Math.max(2, Math.ceil(REVIEW_SIZE / Math.max(1, taught.length)));
    const picked = taught.map((l) => {
      // Exercises run easy → hard; take from the harder half, one of each type first.
      const pool = (l.exercises ?? []).filter((e) => e.type !== 'match');
      const hard = pool.slice(Math.floor(pool.length / 3)).reverse();
      const out: Exercise[] = [];
      for (const e of hard) if (out.length < per && !out.some((o) => o.type === e.type)) out.push(e);
      for (const e of hard) if (out.length < per && !out.includes(e)) out.push(e);
      return out;
    });
    // Interleave lessons so the review mixes points instead of going lesson by lesson.
    const mixed: Exercise[] = [];
    for (let i = 0; picked.some((p) => i < p.length); i++) {
      for (const p of picked) if (p[i]) mixed.push(p[i]);
    }
    return mixed.slice(0, REVIEW_SIZE);
  }
}
