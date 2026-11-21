import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { EnglishCoachService } from '../english/english-coach.service';
import { CefrLevel, EnglishKind } from '../knowledge/entities/knowledge.entity';
import { CourseGeneratorService } from './course-generator.service';
import { COURSE_LEVELS, LESSON_PASS_SCORE } from './course.types';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { CourseAttempt } from './entities/course-attempt.entity';
import { CourseLesson, LessonStatus } from './entities/course-lesson.entity';
import { CourseUnit } from './entities/course-unit.entity';

/** A lesson as listed on the dashboard (no content). */
export interface LessonSummary {
  id: string;
  unitId: string;
  position: number;
  title: string;
  grammar: string;
  vocabTheme: string;
  objective: string;
  status: LessonStatus;
  minutes: number;
  completedAt: Date | null;
  bestScore: number | null;
  attemptCount: number;
  locked: boolean;
}

@Injectable()
export class CourseService {
  private readonly logger = new Logger(CourseService.name);

  constructor(
    @InjectRepository(CourseUnit) private readonly units: Repository<CourseUnit>,
    @InjectRepository(CourseLesson) private readonly lessons: Repository<CourseLesson>,
    @InjectRepository(CourseAttempt) private readonly attempts: Repository<CourseAttempt>,
    private readonly generator: CourseGeneratorService,
    private readonly coach: EnglishCoachService,
  ) {}

  /**
   * A level's units and lessons in study order. A lesson is locked until the
   * one before it (across units) has been passed.
   */
  private async levelPath(level: CefrLevel) {
    const units = await this.units.find({ where: { level }, order: { position: 'ASC' } });
    const rows = await this.lessons.find({
      where: { level },
      select: [
        'id', 'unitId', 'position', 'title', 'grammar', 'vocabTheme', 'objective',
        'status', 'minutes', 'completedAt', 'bestScore', 'attemptCount',
      ],
    });
    const unitPos = new Map(units.map((u) => [u.id, u.position]));
    rows.sort((a, b) => unitPos.get(a.unitId)! - unitPos.get(b.unitId)! || a.position - b.position);
    const ordered: LessonSummary[] = rows.map((l, i) => ({
      ...l,
      locked: i > 0 && !rows[i - 1].completedAt,
    }));
    return { units, ordered };
  }

  async overview(level: CefrLevel) {
    const levels = await Promise.all(
      COURSE_LEVELS.map(async (lvl) => {
        const rows = await this.lessons.find({
          where: { level: lvl },
          select: ['id', 'status', 'completedAt'],
        });
        return {
          level: lvl,
          total: rows.length,
          ready: rows.filter((r) => r.status === LessonStatus.READY).length,
          failed: rows.filter((r) => r.status === LessonStatus.FAILED).length,
          done: rows.filter((r) => r.completedAt).length,
          generating: this.generator.isRunning(lvl),
          error: this.generator.outlineError(lvl),
        };
      }),
    );

    const { units, ordered } = await this.levelPath(level);
    const byUnit = new Map<string, LessonSummary[]>();
    for (const l of ordered) byUnit.set(l.unitId, [...(byUnit.get(l.unitId) ?? []), l]);
    const next = ordered.find((l) => !l.completedAt) ?? null;
    const scored = ordered.filter((l) => l.bestScore !== null);
    const completed = await this.lessons.find({
      where: { level, completedAt: Not(IsNull()) },
      select: ['id', 'vocab'],
    });

    return {
      level,
      levels,
      units: units.map((u) => ({ ...u, lessons: byUnit.get(u.id) ?? [] })),
      next,
      progress: { done: ordered.filter((l) => l.completedAt).length, total: ordered.length },
      averageScore: scored.length
        ? Math.round(scored.reduce((s, l) => s + (l.bestScore ?? 0), 0) / scored.length)
        : null,
      vocabLearned: completed.reduce((n, l) => n + (l.vocab?.length ?? 0), 0),
      passScore: LESSON_PASS_SCORE,
    };
  }

  async lesson(id: string) {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);
    const unit = await this.units.findOne({ where: { id: lesson.unitId } });
    const { ordered } = await this.levelPath(lesson.level);
    const index = ordered.findIndex((l) => l.id === id);
    return {
      lesson,
      unit,
      locked: ordered[index]?.locked ?? false,
      index: index + 1,
      total: ordered.length,
      prevId: ordered[index - 1]?.id ?? null,
      nextId: ordered[index + 1]?.id ?? null,
      passScore: LESSON_PASS_SCORE,
    };
  }

  /**
   * Record a practice run. Passing it the first time completes the lesson
   * (unlocking the next) and files its vocabulary as review cards.
   */
  async submitAttempt(id: string, dto: SubmitAttemptDto) {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);
    const correct = Math.min(dto.correct, dto.total);
    const score = Math.round((correct / dto.total) * 100);
    await this.attempts.save(
      this.attempts.create({ lessonId: id, score, correct, total: dto.total, answers: dto.answers ?? null }),
    );

    const passed = score >= LESSON_PASS_SCORE;
    const firstPass = passed && !lesson.completedAt;
    lesson.attemptCount += 1;
    lesson.bestScore = Math.max(lesson.bestScore ?? 0, score);
    if (firstPass) lesson.completedAt = new Date();
    await this.lessons.save(lesson);

    if (firstPass && lesson.vocab?.length) {
      // Best-effort and in the background: embedding each card takes a moment.
      void this.coach
        .collect(
          lesson.vocab.map((v) => ({
            kind: EnglishKind.VOCAB,
            front: v.word,
            meaning: `${v.meaning}${v.ipa ? ` ${v.ipa}` : ''} — ${v.example}`,
            cefrLevel: lesson.level,
            hard: false,
          })),
          lesson.id,
        )
        .catch((e) => this.logger.error(`vocab cards for ${id}: ${e.message}`));
    }

    const { ordered } = await this.levelPath(lesson.level);
    const index = ordered.findIndex((l) => l.id === id);
    return {
      score,
      passed,
      firstPass,
      bestScore: lesson.bestScore,
      passScore: LESSON_PASS_SCORE,
      cardsAdded: firstPass ? lesson.vocab?.length ?? 0 : 0,
      nextId: ordered[index + 1]?.id ?? null,
    };
  }
}
