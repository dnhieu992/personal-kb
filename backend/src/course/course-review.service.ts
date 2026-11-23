import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { Exercise } from './course.types';
import { CourseAttempt } from './entities/course-attempt.entity';
import { CourseExerciseStat } from './entities/course-exercise-stat.entity';
import { CourseLesson, LessonKind, LessonStatus } from './entities/course-lesson.entity';
import { PlacementService } from './placement.service';
import { syllabusPoint } from './syllabus';

const DAY = 86_400_000;
/** Days until the next review after 1, 2 right answers in a row; the 3rd resolves it. */
const INTERVALS = [1, 3, 7];
const RESOLVED_AT = 3;
const FOCUS_SIZE = 10;
const DAILY_SIZE = 15;

/** One answered exercise, pointing at where it really lives. */
export interface AnswerRecord {
  lessonId: string;
  index: number;
  correct: boolean;
  answer?: Record<string, unknown>;
}

/** An exercise handed to a review test, with where its result goes. */
export interface ReviewItem {
  lessonId: string;
  index: number;
  lessonTitle: string;
  point: { key: string; name: string; vi: string } | null;
  exercise: Exercise;
  /** It was answered wrong before (vs a fresh one on the same point). */
  missed: boolean;
}

export interface WeakPoint {
  key: string;
  name: string;
  vi: string;
  level: string | null;
  seen: number;
  wrong: number;
  /** Share of answers that were right, 0–100 (null before any answer). */
  accuracy: number | null;
  /** Missed exercises due for review now. */
  due: number;
  /** Missed exercises not resolved yet. */
  open: number;
  /** The placement test flagged it. */
  placement: boolean;
  lessons: { id: string; title: string }[];
}

/** Key for a lesson's point(s): its syllabus keys, or the lesson itself for workplace extras. */
const keysOf = (l: Pick<CourseLesson, 'id' | 'syllabusKeys'>) =>
  l.syllabusKeys?.length ? l.syllabusKeys : [`lesson:${l.id}`];

/** The "Lỗi hay gặp" (common mistakes) section of a lesson's theory. */
function mistakesSection(theory: string | null): string | null {
  if (!theory) return null;
  const m = theory.match(/^##\s*Lỗi hay gặp[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m);
  return m?.[1]?.trim() || null;
}

const sameExercise = (a: Exercise, b: Exercise) =>
  a.type === b.type &&
  a.prompt === b.prompt &&
  (a.passage ?? '') === (b.passage ?? '') &&
  a.answer[0] === b.answer[0];

/**
 * Review built on the learner's own mistakes: every answered exercise is
 * tracked, wrong ones come back on a spaced schedule, and they are grouped by
 * syllabus point so the weakest points (not single words) drive what to study.
 */
@Injectable()
export class CourseReviewService implements OnModuleInit {
  private readonly logger = new Logger(CourseReviewService.name);

  constructor(
    @InjectRepository(CourseExerciseStat) private readonly stats: Repository<CourseExerciseStat>,
    @InjectRepository(CourseLesson) private readonly lessons: Repository<CourseLesson>,
    @InjectRepository(CourseAttempt) private readonly attempts: Repository<CourseAttempt>,
    private readonly placement: PlacementService,
  ) {}

  /** First boot with this feature: replay past lesson runs so earlier mistakes count. */
  async onModuleInit() {
    try {
      if (await this.stats.count()) return;
      const runs = await this.attempts.find({ order: { createdAt: 'ASC' } });
      let replayed = 0;
      for (const run of runs) {
        const answers = (run.answers ?? []) as { type?: string; correct?: boolean; index?: number }[];
        const lesson = await this.lessons.findOne({ where: { id: run.lessonId } });
        if (!lesson || !answers.length) continue;
        // Before answers carried their index, a full run answered the exercises in order.
        // Quick checks and reviews used subsets that can't be rebuilt reliably: skip them.
        if (lesson.kind !== LessonKind.LESSON || answers.length <= 6) continue;
        const ex = lesson.exercises ?? [];
        const ok = answers.every((a, i) => ex[i] && (a.type === ex[i].type || a.type === 'mcq'));
        if (!ok) continue;
        await this.record(
          lesson,
          answers.map((a, i) => ({ index: i, correct: !!a.correct, answer: a as Record<string, unknown> })),
          run.createdAt,
        );
        replayed++;
      }
      if (replayed) this.logger.log(`replayed ${replayed} past runs into exercise stats`);
    } catch (e) {
      this.logger.warn(`backfill failed: ${(e as Error).message}`);
    }
  }

  /**
   * Record a run of `lesson`. Answers on a unit review are filed under the
   * lesson the exercise was copied from.
   */
  async record(
    lesson: CourseLesson,
    answers: { index: number; correct: boolean; answer?: Record<string, unknown> }[],
    at = new Date(),
  ) {
    let siblings: CourseLesson[] | null = null;
    for (const a of answers) {
      let target: { lesson: Pick<CourseLesson, 'id' | 'level' | 'syllabusKeys'>; index: number } | null = {
        lesson,
        index: a.index,
      };
      if (lesson.kind === LessonKind.REVIEW) {
        const ex = lesson.exercises?.[a.index];
        siblings ??= await this.lessons.find({ where: { unitId: lesson.unitId, kind: LessonKind.LESSON } });
        target = null;
        for (const s of ex ? siblings : []) {
          const i = (s.exercises ?? []).findIndex((e) => sameExercise(e, ex!));
          if (i >= 0) {
            target = { lesson: s, index: i };
            break;
          }
        }
      }
      if (target) await this.recordOne(target.lesson, target.index, a.correct, a.answer, at);
    }
  }

  /** Results of a review test (each item already points at its real lesson/index). */
  async submit(results: AnswerRecord[]) {
    const ids = [...new Set(results.map((r) => r.lessonId))];
    const rows = await this.lessons.find({
      where: { id: In(ids) },
      select: ['id', 'level', 'syllabusKeys', 'exercises'],
    });
    const byId = new Map(rows.map((l) => [l.id, l]));
    for (const r of results) {
      const l = byId.get(r.lessonId);
      if (l?.exercises?.[r.index]) await this.recordOne(l, r.index, r.correct, r.answer);
    }
    const keys = new Set(rows.flatMap(keysOf));
    const points = (await this.weakPoints()).points.filter((p) => keys.has(p.key));
    return {
      correct: results.filter((r) => r.correct).length,
      total: results.length,
      points,
    };
  }

  private async recordOne(
    lesson: Pick<CourseLesson, 'id' | 'level' | 'syllabusKeys'>,
    index: number,
    correct: boolean,
    answer: Record<string, unknown> | undefined,
    at = new Date(),
  ) {
    const stat =
      (await this.stats.findOne({ where: { lessonId: lesson.id, exerciseIndex: index } })) ??
      this.stats.create({ lessonId: lesson.id, exerciseIndex: index, seen: 0, wrong: 0, streak: 0 });
    stat.level = lesson.level;
    stat.syllabusKeys = lesson.syllabusKeys ?? [];
    stat.seen += 1;
    if (!correct) {
      stat.wrong += 1;
      stat.streak = 0;
      stat.dueAt = at;
      stat.lastWrongAt = at;
      if (answer) {
        const { correct: _c, index: _i, ...rest } = answer as Record<string, unknown>;
        stat.lastAnswer = rest;
      }
    } else if (stat.dueAt) {
      // In review: each right answer pushes it further out, the third resolves it.
      stat.streak += 1;
      stat.dueAt =
        stat.streak >= RESOLVED_AT ? null : new Date(at.getTime() + INTERVALS[stat.streak - 1] * DAY);
    } else {
      stat.streak += 1;
    }
    await this.stats.save(stat).catch((e) => {
      if (!String(e.message).includes('Duplicate')) throw e;
    });
  }

  private pointInfo(key: string, lessonsById: Map<string, CourseLesson>) {
    if (key.startsWith('lesson:')) {
      const l = lessonsById.get(key.slice(7));
      return { key, name: l?.grammar ?? 'Bài học', vi: l?.title ?? '', level: l?.level ?? null };
    }
    const p = syllabusPoint(key);
    return { key, name: p?.name ?? key, vi: p?.vi ?? '', level: p?.level ?? null };
  }

  /** Points ranked weakest first: due mistakes, then error rate; placement weak points included. */
  async weakPoints(): Promise<{ points: WeakPoint[]; due: number; open: number; resolved: number }> {
    const now = new Date();
    const [all, lessons, placement] = await Promise.all([
      this.stats.find(),
      this.lessons.find({
        where: { kind: LessonKind.LESSON },
        select: ['id', 'title', 'grammar', 'level', 'syllabusKeys', 'completedAt', 'attemptCount'],
      }),
      this.placement.latest(),
    ]);
    const lessonsById = new Map(lessons.map((l) => [l.id, l]));
    const agg = new Map<string, WeakPoint>();
    const point = (key: string) => {
      let p = agg.get(key);
      if (!p) {
        const info = this.pointInfo(key, lessonsById);
        p = { ...info, seen: 0, wrong: 0, accuracy: null, due: 0, open: 0, placement: false, lessons: [] };
        agg.set(key, p);
      }
      return p;
    };
    for (const s of all) {
      const l = lessonsById.get(s.lessonId);
      for (const key of l ? keysOf(l) : []) {
        const p = point(key);
        p.seen += s.seen;
        p.wrong += s.wrong;
        if (s.dueAt) p.open += 1;
        if (s.dueAt && s.dueAt <= now) p.due += 1;
      }
    }
    for (const key of placement?.weak ?? []) point(key).placement = true;
    for (const p of agg.values()) {
      p.accuracy = p.seen ? Math.round(((p.seen - p.wrong) / p.seen) * 100) : null;
      p.lessons = lessons
        .filter((l) => keysOf(l).includes(p.key))
        .map((l) => ({ id: l.id, title: l.title }));
    }
    const points = [...agg.values()]
      .filter((p) => p.wrong > 0 || p.placement)
      .sort(
        (a, b) =>
          b.due - a.due ||
          b.open - a.open ||
          (a.accuracy ?? 101) - (b.accuracy ?? 101) ||
          b.wrong - a.wrong,
      );
    return {
      points,
      due: all.filter((s) => s.dueAt && s.dueAt <= now).length,
      open: all.filter((s) => s.dueAt).length,
      resolved: all.filter((s) => s.wrong > 0 && !s.dueAt).length,
    };
  }

  /**
   * Study one weak point: the "common mistakes" part of its lessons, your own
   * wrong answers as worked examples, and a short test (missed items first).
   */
  async focus(key: string) {
    const lessons = (
      await this.lessons.find({ where: { kind: LessonKind.LESSON, status: LessonStatus.READY } })
    ).filter((l) => keysOf(l).includes(key));
    if (!lessons.length) throw new NotFoundException(`No lessons for ${key}`);
    const lessonsById = new Map(lessons.map((l) => [l.id, l]));
    const info = this.pointInfo(key, lessonsById);
    const stats = await this.stats.find({ where: { lessonId: In(lessons.map((l) => l.id)) } });
    const statOf = (lessonId: string, i: number) =>
      stats.find((s) => s.lessonId === lessonId && s.exerciseIndex === i);

    const mistakes = stats
      .filter((s) => s.wrong > 0)
      .sort((a, b) => Number(!!b.dueAt) - Number(!!a.dueAt) || b.wrong - a.wrong)
      .map((s) => {
        const l = lessonsById.get(s.lessonId)!;
        return {
          lessonId: l.id,
          lessonTitle: l.title,
          index: s.exerciseIndex,
          exercise: l.exercises![s.exerciseIndex],
          answer: s.lastAnswer,
          wrong: s.wrong,
          resolved: !s.dueAt,
        };
      })
      .filter((m) => m.exercise);

    return {
      point: info,
      tips: lessons
        .map((l) => ({ lessonId: l.id, lessonTitle: l.title, markdown: mistakesSection(l.theory) }))
        .filter((t) => t.markdown),
      mistakes,
      test: this.buildTest(lessons, statOf, FOCUS_SIZE, (l) => ({ key, name: info.name, vi: info.vi })),
    };
  }

  /** Today's mixed test: due mistakes first, topped up with fresh items on the weakest points. */
  async daily() {
    const { points } = await this.weakPoints();
    const now = new Date();
    const due = await this.stats.find({ where: { dueAt: LessThanOrEqual(now) }, order: { dueAt: 'ASC' } });
    // Only lessons the learner has opened: a review shouldn't test what was never taught.
    const studied = await this.lessons.find({
      where: [
        { kind: LessonKind.LESSON, completedAt: Not(IsNull()) },
        { kind: LessonKind.LESSON, attemptCount: Not(0) },
      ],
    });
    const byId = new Map(studied.map((l) => [l.id, l]));
    const items: ReviewItem[] = [];
    const taken = new Set<string>();
    const add = (l: CourseLesson, i: number, missed: boolean) => {
      const id = `${l.id}:${i}`;
      const exercise = l.exercises?.[i];
      if (!exercise || taken.has(id) || items.length >= DAILY_SIZE) return;
      taken.add(id);
      const key = keysOf(l)[0];
      const info = this.pointInfo(key, byId);
      items.push({ lessonId: l.id, index: i, lessonTitle: l.title, point: info, exercise, missed });
    };
    for (const s of due) {
      const l = byId.get(s.lessonId);
      if (l) add(l, s.exerciseIndex, true);
      if (items.length >= Math.ceil(DAILY_SIZE * 0.7)) break;
    }
    // Fill with not-yet-answered items from the weakest studied points.
    const stats = await this.stats.find({ where: { lessonId: In([...byId.keys()].length ? [...byId.keys()] : ['-']) } });
    const answered = new Set(stats.map((s) => `${s.lessonId}:${s.exerciseIndex}`));
    // Grammar drills first, at most 3 fresh items per point and one reading per passage.
    const rank: Partial<Record<Exercise['type'], number>> = { fix: 0, gap: 1, mcq: 2, order: 3, listen: 4, read: 5 };
    const passages = new Set<string>();
    for (const p of points) {
      let added = 0;
      const pool = studied
        .filter((x) => keysOf(x).includes(p.key))
        .flatMap((l) => (l.exercises ?? []).map((e, i) => ({ l, e, i })))
        .filter(({ l, e, i }) => rank[e.type] !== undefined && !answered.has(`${l.id}:${i}`))
        .sort((a, b) => rank[a.e.type]! - rank[b.e.type]! || b.i - a.i);
      for (const { l, e, i } of pool) {
        if (added >= 3 || items.length >= DAILY_SIZE) break;
        if (e.type === 'read' && passages.has(e.passage ?? '')) continue;
        const before = items.length;
        add(l, i, false);
        if (items.length > before) {
          added++;
          if (e.type === 'read') passages.add(e.passage ?? '');
        }
      }
    }
    return { items, due: due.length };
  }

  private buildTest(
    lessons: CourseLesson[],
    statOf: (lessonId: string, i: number) => CourseExerciseStat | undefined,
    size: number,
    point: (l: CourseLesson) => ReviewItem['point'],
  ): ReviewItem[] {
    const missed: ReviewItem[] = [];
    const fresh: ReviewItem[] = [];
    for (const l of lessons) {
      (l.exercises ?? []).forEach((exercise, index) => {
        if (exercise.type === 'match') return;
        const s = statOf(l.id, index);
        const item = { lessonId: l.id, index, lessonTitle: l.title, point: point(l), exercise, missed: !!s?.dueAt };
        if (s?.dueAt) missed.push(item);
        // Fresh: never answered, or answered right without ever missing it (skip resolved mistakes).
        else if (!s || s.wrong === 0) fresh.push(item);
      });
    }
    // Spread the fresh ones across exercise types (harder half first: the lists run easy → hard).
    fresh.reverse();
    const picked: ReviewItem[] = [...missed.slice(0, size)];
    const byType = new Map<string, ReviewItem[]>();
    for (const f of fresh) byType.set(f.exercise.type, [...(byType.get(f.exercise.type) ?? []), f]);
    while (picked.length < size && [...byType.values()].some((v) => v.length)) {
      for (const list of byType.values()) {
        const next = list.shift();
        if (next && picked.length < size && !next.exercise.type.startsWith('write')) picked.push(next);
      }
    }
    return picked;
  }
}
