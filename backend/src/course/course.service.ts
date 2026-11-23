import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { EnglishCoachService } from '../english/english-coach.service';
import { CefrLevel, EnglishKind } from '../knowledge/entities/knowledge.entity';
import { CourseGeneratorService } from './course-generator.service';
import { CourseAiService } from '../ai/course-ai.service';
import {
  COURSE_LEVELS,
  SKILLS_VERSION,
  DEFAULT_WEEKLY_LESSONS,
  LESSON_PASS_SCORE,
  LESSONS_PER_UNIT,
  PLANNED_PER_LEVEL,
  QUICK_CHECK_PASS_SCORE,
  REVIEW_PASS_SCORE,
  UNITS_PER_LEVEL,
} from './course.types';
import { SetGoalDto } from './dto/goal.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { CourseAttempt } from './entities/course-attempt.entity';
import { CourseGoal } from './entities/course-goal.entity';
import { CourseLesson, LessonKind, LessonStatus } from './entities/course-lesson.entity';
import { CourseUnit } from './entities/course-unit.entity';
import { PlacementService } from './placement.service';
import { frameworkFor, SOURCES, syllabusPoint } from './syllabus';

/**
 * What the latest placement test says about a lesson's grammar:
 * - mastered: every point it teaches was answered right → it doesn't block the
 *   path, and a short quick check (≥ 80%) completes it;
 * - weak: a point it teaches was answered wrong → it is unlocked straight away
 *   and recommended first.
 */
export type Mastery = 'mastered' | 'weak' | null;

interface PlacementView {
  mastered: string[];
  weak: string[];
}

const DAY = 86_400_000;
/** AI score a written answer needs to count as right. */
const WRITE_PASS_SCORE = 70;
const levelIndex = (l: CefrLevel) => COURSE_LEVELS.indexOf(l);
/** Calendar day in Vietnam (the learner's clock; the server runs on UTC). */
const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

const passScoreOf = (kind: LessonKind, quick?: boolean) =>
  quick ? QUICK_CHECK_PASS_SCORE : kind === LessonKind.REVIEW ? REVIEW_PASS_SCORE : LESSON_PASS_SCORE;

function masteryOf(keys: string[] | null, p: PlacementView | null, kind?: LessonKind): Mastery {
  if (!p || !keys?.length || kind === LessonKind.REVIEW) return null;
  if (keys.some((k) => p.weak.includes(k))) return 'weak';
  if (keys.every((k) => p.mastered.includes(k))) return 'mastered';
  return null;
}

/** A lesson as listed on the dashboard (no content). */
export interface LessonSummary {
  id: string;
  unitId: string;
  position: number;
  kind: LessonKind;
  title: string;
  grammar: string;
  vocabTheme: string;
  objective: string;
  status: LessonStatus;
  minutes: number;
  completedAt: Date | null;
  bestScore: number | null;
  attemptCount: number;
  syllabusKeys: string[] | null;
  mastery: Mastery;
  locked: boolean;
}

/** Where to go next: weak points first, then the path, skipping placement-mastered lessons. */
function pickNext(ordered: LessonSummary[]): LessonSummary | null {
  const open = (l: LessonSummary) => !l.completedAt && !l.locked && l.status === LessonStatus.READY;
  return (
    ordered.find((l) => open(l) && l.mastery === 'weak') ??
    ordered.find((l) => open(l) && l.mastery !== 'mastered') ??
    ordered.find((l) => !l.completedAt && l.mastery !== 'mastered') ??
    ordered.find((l) => !l.completedAt) ??
    null
  );
}

@Injectable()
export class CourseService {
  private readonly logger = new Logger(CourseService.name);

  constructor(
    @InjectRepository(CourseUnit) private readonly units: Repository<CourseUnit>,
    @InjectRepository(CourseLesson) private readonly lessons: Repository<CourseLesson>,
    @InjectRepository(CourseAttempt) private readonly attempts: Repository<CourseAttempt>,
    @InjectRepository(CourseGoal) private readonly goals: Repository<CourseGoal>,
    private readonly generator: CourseGeneratorService,
    private readonly coach: EnglishCoachService,
    private readonly placement: PlacementService,
    private readonly ai: CourseAiService,
  ) {}

  /** No level asked for: the placement test's level, else B1. */
  async defaultLevel(): Promise<CefrLevel> {
    return (await this.placement.latest())?.placedLevel ?? CefrLevel.B1;
  }

  /**
   * A level's units and lessons in study order. A lesson is locked while an
   * earlier one (across units) is neither passed nor mastered in the placement
   * test; lessons on weak points are never locked.
   */
  private async levelPath(level: CefrLevel) {
    const placement = await this.placement.latest();
    const units = await this.units.find({ where: { level }, order: { position: 'ASC' } });
    const rows = await this.lessons.find({
      where: { level },
      select: [
        'id', 'unitId', 'position', 'kind', 'title', 'grammar', 'vocabTheme', 'objective',
        'status', 'minutes', 'completedAt', 'bestScore', 'attemptCount', 'syllabusKeys',
      ],
    });
    const unitPos = new Map(units.map((u) => [u.id, u.position]));
    rows.sort((a, b) => unitPos.get(a.unitId)! - unitPos.get(b.unitId)! || a.position - b.position);
    let blocked = false;
    const ordered: LessonSummary[] = rows.map((l) => {
      const mastery = masteryOf(l.syllabusKeys, placement, l.kind);
      const locked = blocked && !l.completedAt && mastery !== 'weak';
      if (!l.completedAt && mastery !== 'mastered') blocked = true;
      return { ...l, mastery, locked };
    });
    return { units, ordered, placement };
  }

  async overview(level: CefrLevel) {
    const levels = await Promise.all(
      COURSE_LEVELS.map(async (lvl) => {
        const rows = await this.lessons.find({
          where: { level: lvl },
          select: ['id', 'status', 'completedAt', 'kind', 'skillsVersion'],
        });
        return {
          level: lvl,
          units: await this.units.count({ where: { level: lvl } }),
          total: rows.length,
          ready: rows.filter((r) => r.status === LessonStatus.READY).length,
          failed: rows.filter((r) => r.status === LessonStatus.FAILED).length,
          /** Written before listening/reading/writing existed: the next generate run adds them. */
          needSkills: rows.filter(
            (r) => r.kind === LessonKind.LESSON && r.status === LessonStatus.READY && r.skillsVersion < SKILLS_VERSION,
          ).length,
          done: rows.filter((r) => r.completedAt).length,
          generating: this.generator.isRunning(lvl),
          error: this.generator.outlineError(lvl),
        };
      }),
    );

    const { units, ordered, placement } = await this.levelPath(level);
    const byUnit = new Map<string, LessonSummary[]>();
    for (const l of ordered) byUnit.set(l.unitId, [...(byUnit.get(l.unitId) ?? []), l]);
    const next = pickNext(ordered);
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
      quickPassScore: QUICK_CHECK_PASS_SCORE,
      reviewPassScore: REVIEW_PASS_SCORE,
      plan: { units: UNITS_PER_LEVEL, lessonsPerUnit: LESSONS_PER_UNIT },
      journey: await this.journey(),
      placement,
      focus: ordered.filter((l) => l.mastery === 'weak' && !l.completedAt),
      framework: this.framework(level, ordered),
    };
  }

  /** The level's reference syllabus and which of its points the lessons cover. */
  private framework(level: CefrLevel, ordered: LessonSummary[]) {
    const f = frameworkFor(level);
    if (!f) return null;
    const keyed = ordered.filter((l) => l.syllabusKeys?.length && l.kind === LessonKind.LESSON);
    return {
      gse: f.gse,
      efset: f.efset,
      canDo: f.canDo,
      functions: f.functions,
      points: f.points.map((p) => {
        const lessons = keyed.filter((l) => l.syllabusKeys!.includes(p.key));
        return {
          ...p,
          lessonIds: lessons.map((l) => l.id),
          done: lessons.length > 0 && lessons.every((l) => l.completedAt),
        };
      }),
      /** Lessons teaching points from other levels' lists (review / preview). */
      extra: keyed
        .flatMap((l) => l.syllabusKeys!)
        .filter((k, i, all) => all.indexOf(k) === i && !f.points.some((p) => p.key === k))
        .map((k) => syllabusPoint(k))
        .filter(Boolean),
      sources: SOURCES,
    };
  }

  async lesson(id: string) {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);
    const unit = await this.units.findOne({ where: { id: lesson.unitId } });
    const { ordered } = await this.levelPath(lesson.level);
    const index = ordered.findIndex((l) => l.id === id);
    // What keeps a locked lesson closed: the first earlier lesson neither passed nor mastered.
    const blocker = ordered[index]?.locked
      ? ordered.slice(0, index).find((l) => !l.completedAt && l.mastery !== 'mastered')
      : undefined;
    const unitPos = new Map(
      (await this.units.find({ where: { level: lesson.level }, select: ['id', 'position'] })).map((u) => [u.id, u.position]),
    );
    return {
      lesson,
      unit,
      blockedBy: blocker
        ? { id: blocker.id, title: blocker.title, unit: unitPos.get(blocker.unitId) ?? null, position: blocker.position }
        : null,
      locked: ordered[index]?.locked ?? false,
      mastery: ordered[index]?.mastery ?? null,
      points: (lesson.syllabusKeys ?? []).map((k) => syllabusPoint(k)).filter(Boolean),
      quickPassScore: QUICK_CHECK_PASS_SCORE,
      index: index + 1,
      total: ordered.length,
      prevId: ordered[index - 1]?.id ?? null,
      nextId: ordered[index + 1]?.id ?? null,
      passScore: passScoreOf(lesson.kind),
      journey: await this.journey(),
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

    const passScore = passScoreOf(lesson.kind, dto.quick);
    const passed = score >= passScore;
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
    // Lessons can be done out of order (weak points open early), so "next" is the
    // lesson the path recommends now, not simply the one after this.
    const after = ordered[index + 1];
    const recommended = pickNext(ordered);
    const nextId =
      recommended && !recommended.locked && recommended.status === LessonStatus.READY
        ? recommended.id
        : after && !after.locked
          ? after.id
          : null;
    return {
      score,
      passed,
      firstPass,
      bestScore: lesson.bestScore,
      passScore,
      cardsAdded: firstPass ? lesson.vocab?.length ?? 0 : 0,
      nextId,
      journey: await this.journey(),
    };
  }

  /**
   * Grade a written answer (`write` exercise #index of the lesson). The task and
   * model answers come from the stored lesson, not the client.
   */
  async gradeWriting(id: string, index: number, text: string) {
    const lesson = await this.lessons.findOne({ where: { id } });
    const ex = lesson?.exercises?.[index];
    if (!lesson || !ex || ex.type !== 'write') throw new NotFoundException('Writing exercise not found');
    const answer = text.trim().slice(0, 1000);
    if (this.ai.isEnabled()) {
      try {
        const g = await this.ai.gradeWriting({
          level: lesson.level,
          task: ex.prompt,
          models: ex.answer,
          criteria: ex.explanation,
          text: answer,
        });
        return { ...g, correct: g.score >= WRITE_PASS_SCORE, ai: true };
      } catch (e) {
        this.logger.warn(`grading writing failed: ${(e as Error).message}`);
      }
    }
    // No AI: only an answer matching a model answer can be recognised as right.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const match = ex.answer.some((a) => norm(a) === norm(answer));
    return {
      score: match ? 100 : 0,
      correct: match,
      feedback: match
        ? 'Khớp với câu mẫu.'
        : 'Không chấm được bằng AI lúc này — so với câu mẫu bên dưới và tự đánh giá nhé.',
      corrected: '',
      ai: false,
    };
  }

  // --- goal & journey ---

  /** Set where the journey goes and how fast. The start stays unless given. */
  async setGoal(dto: SetGoalDto) {
    const current = await this.goals.find({ take: 1 });
    const start = dto.startLevel ?? current[0]?.startLevel ?? (await this.defaultLevel());
    const target = levelIndex(dto.targetLevel) < levelIndex(start) ? start : dto.targetLevel;
    await this.goals.save({
      ...(current[0] ?? {}),
      startLevel: start,
      targetLevel: target,
      weeklyLessons: dto.weeklyLessons,
    });
    return this.journey();
  }

  /**
   * The whole way from the start level to the end of the target level: how much
   * is done, the pace, and when the finish line is reached at that pace. Levels
   * not fully written yet count with their planned size, so the % doesn't jump
   * backwards as content lands.
   */
  async journey() {
    const [goal] = await this.goals.find({ take: 1 });
    const start = goal?.startLevel ?? (await this.defaultLevel());
    const maxIndex = COURSE_LEVELS.length - 1;
    const target =
      goal && levelIndex(goal.targetLevel) >= levelIndex(start)
        ? goal.targetLevel
        : COURSE_LEVELS[Math.min(levelIndex(start) + 1, maxIndex)];
    const weeklyLessons = goal?.weeklyLessons ?? DEFAULT_WEEKLY_LESSONS;
    const path = COURSE_LEVELS.slice(levelIndex(start), levelIndex(target) + 1);

    const rows = await this.lessons.find({
      where: { level: In(path) },
      select: ['id', 'level', 'completedAt', 'minutes'],
    });
    const levels = await Promise.all(
      path.map(async (level) => {
        const mine = rows.filter((r) => r.level === level);
        const units = await this.units.count({ where: { level } });
        const estimated = units < UNITS_PER_LEVEL;
        const total = estimated ? Math.max(mine.length, PLANNED_PER_LEVEL) : mine.length;
        const done = mine.filter((r) => r.completedAt).length;
        const minutesLeft =
          mine.filter((r) => !r.completedAt).reduce((n, r) => n + (r.minutes || 15), 0) +
          (total - mine.length) * 15;
        return { level, done, total, estimated, minutesLeft };
      }),
    );
    const done = levels.reduce((n, l) => n + l.done, 0);
    const total = levels.reduce((n, l) => n + l.total, 0);
    const left = total - done;

    // Pace: lessons passed in the last 4 weeks (any level), and the last 7 days.
    const now = Date.now();
    const recent = await this.lessons.find({
      where: { completedAt: MoreThan(new Date(now - 28 * DAY)) },
      select: ['id', 'completedAt'],
    });
    const last7 = recent.filter((r) => r.completedAt!.getTime() > now - 7 * DAY).length;
    const pace = Math.round((recent.length / 4) * 10) / 10;

    // Streak: consecutive Vietnam days with at least one practice run.
    const attempts = await this.attempts.find({
      where: { createdAt: MoreThan(new Date(now - 120 * DAY)) },
      select: ['id', 'createdAt'],
    });
    const days = new Set(attempts.map((a) => vnDay(a.createdAt)));
    const today = vnDay(new Date(now));
    let streak = 0;
    let cursor = days.has(today) ? now : now - DAY;
    while (days.has(vnDay(new Date(cursor)))) {
      streak++;
      cursor -= DAY;
    }

    const eta = (perWeek: number) =>
      perWeek > 0 && left > 0 ? new Date(now + Math.ceil((left / perWeek) * 7) * DAY) : null;

    // The next lesson on the way: in the first path level that isn't finished.
    let next: LessonSummary | null = null;
    for (const l of levels) {
      if (l.done >= l.total) continue;
      const { ordered } = await this.levelPath(l.level);
      next = pickNext(ordered);
      if (next) break;
    }

    return {
      start,
      target,
      goalSet: !!goal,
      weeklyLessons,
      levels,
      done,
      total,
      // One decimal, rounded down: the first lessons show up (0.7%) and 100 means done.
      pct: total ? Math.floor((done / total) * 1000) / 10 : 0,
      minutesLeft: levels.reduce((n, l) => n + l.minutesLeft, 0),
      last7,
      pace,
      streak,
      studiedToday: days.has(today),
      etaAtGoal: eta(weeklyLessons),
      // Too little history makes the pace meaningless (1 lesson → "year 2040").
      etaAtPace: recent.length >= 3 ? eta(pace) : null,
      next: next && {
        id: next.id,
        title: next.title,
        level: rows.find((r) => r.id === next!.id)?.level ?? start,
        status: next.status,
        locked: next.locked,
        mastery: next.mastery,
        kind: next.kind,
      },
    };
  }
}
