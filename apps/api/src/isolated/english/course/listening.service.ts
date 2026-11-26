import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseAiService } from './course-ai.service';
import { CourseGeneratorService } from './course-generator.service';
import {
  LESSONS_PER_UNIT,
  LISTENING_PASS_SCORE,
  listeningTarget,
  SummaryGrade,
  UNITS_PER_LEVEL,
} from './course.types';
import { CourseLesson, LessonKind, LessonStatus } from './entities/course-lesson.entity';
import { CourseListening, ListeningStatus } from './entities/course-listening.entity';
import { CourseUnit } from './entities/course-unit.entity';

const TRIES = 2;
/** A summary shorter than this can't carry the passage's main ideas. */
export const MIN_SUMMARY_WORDS = 15;
const wordsIn = (s: string) => (s.match(/[\p{L}0-9'’-]+/gu) ?? []).length;

/**
 * Listening tasks: one per taught lesson, written by the AI the first time the
 * learner opens it (background, ~1 min), then kept. The summary is graded by
 * the AI against the task's key ideas; covering ≥ LISTENING_PASS_SCORE % passes.
 * Independent of the lesson's own pass mark (it never locks the path).
 */
@Injectable()
export class ListeningService implements OnModuleInit {
  private readonly logger = new Logger(ListeningService.name);

  constructor(
    @InjectRepository(CourseListening) private readonly tasks: Repository<CourseListening>,
    @InjectRepository(CourseLesson) private readonly lessons: Repository<CourseLesson>,
    @InjectRepository(CourseUnit) private readonly units: Repository<CourseUnit>,
    private readonly generator: CourseGeneratorService,
    private readonly ai: CourseAiService,
  ) {}

  /** A restart kills in-flight jobs: let the learner start them again. */
  async onModuleInit() {
    await this.tasks.update(
      { status: ListeningStatus.GENERATING },
      { status: ListeningStatus.FAILED, error: 'Bị ngắt giữa chừng (server khởi động lại) — bấm tạo lại.' },
    );
  }

  /** The lesson's listening task (null before it is first created) and its planned length. */
  async get(lessonId: string) {
    const lesson = await this.lessonOrThrow(lessonId);
    const task = await this.tasks.findOne({ where: { lessonId } });
    return {
      task,
      targetWords: task?.targetWords ?? (await this.targetFor(lesson)),
      passScore: LISTENING_PASS_SCORE,
      minSummaryWords: MIN_SUMMARY_WORDS,
      enabled: this.ai.isEnabled(),
    };
  }

  /** Write (or rewrite) the task in the background; progress is lost on a rewrite. */
  async generate(lessonId: string) {
    const lesson = await this.lessonOrThrow(lessonId);
    if (!this.ai.isEnabled()) throw new BadRequestException('AI chưa được cấu hình trên server');
    const existing = await this.tasks.findOne({ where: { lessonId } });
    if (existing?.status === ListeningStatus.GENERATING) return this.get(lessonId);
    const targetWords = await this.targetFor(lesson);
    await this.tasks.save(
      this.tasks.create({
        ...(existing ?? {}),
        lessonId,
        level: lesson.level,
        targetWords,
        status: ListeningStatus.GENERATING,
        error: null,
        bestScore: null,
        passedAt: null,
        attemptCount: 0,
        lastSummary: null,
        lastGrade: null,
      }),
    );
    void this.write(lesson, targetWords);
    return this.get(lessonId);
  }

  private async write(lesson: CourseLesson, words: number) {
    const unit = await this.units.findOne({ where: { id: lesson.unitId } });
    const siblings = await this.lessons.find({ where: { level: lesson.level, kind: LessonKind.LESSON } });
    const spec = this.generator.specOf(lesson, unit, siblings);
    const vocab = (lesson.vocab ?? []).map((v) => v.word);
    let lastError = '';
    for (let attempt = 1; attempt <= TRIES; attempt++) {
      try {
        const c = await this.ai.generateListening(spec, vocab, words);
        await this.tasks.update(
          { lessonId: lesson.id },
          {
            ...c,
            wordCount: wordsIn(c.passage),
            status: ListeningStatus.READY,
            error: null,
          },
        );
        this.logger.log(`listening for "${lesson.title}" ready (${wordsIn(c.passage)} words)`);
        return;
      } catch (e) {
        lastError = (e as Error).message;
        this.logger.warn(`listening for "${lesson.title}" try ${attempt} failed: ${lastError}`);
      }
    }
    await this.tasks.update(
      { lessonId: lesson.id },
      { status: ListeningStatus.FAILED, error: lastError.slice(0, 1000) },
    );
  }

  /** Grade a summary: share of key ideas covered (partial = half). */
  async grade(lessonId: string, text: string, questionsCorrect?: number): Promise<SummaryGrade & { bestScore: number }> {
    const task = await this.tasks.findOne({ where: { lessonId } });
    if (!task || task.status !== ListeningStatus.READY || !task.passage || !task.ideas?.length) {
      throw new NotFoundException('Bài nghe chưa sẵn sàng');
    }
    const summary = text.trim().slice(0, 4000);
    if (wordsIn(summary) < MIN_SUMMARY_WORDS) {
      throw new BadRequestException(`Tóm tắt cần ít nhất ${MIN_SUMMARY_WORDS} từ`);
    }
    if (!this.ai.isEnabled()) throw new BadRequestException('AI chưa được cấu hình trên server — không chấm được');

    const g = await this.ai.gradeSummary({ level: task.level, passage: task.passage, ideas: task.ideas, summary });
    const byIndex = new Map(g.ideas.map((v) => [v.index, v]));
    const ideas = task.ideas.map((idea, index) => {
      const v = byIndex.get(index);
      return { ...idea, index, status: v?.status ?? 'missing', note: v?.note ?? '' } as SummaryGrade['ideas'][number];
    });
    const points = ideas.reduce((s, i) => s + (i.status === 'covered' ? 1 : i.status === 'partial' ? 0.5 : 0), 0);
    const score = Math.round((points / ideas.length) * 100);
    const result: SummaryGrade = {
      score,
      passed: score >= LISTENING_PASS_SCORE,
      ideas,
      feedback: g.feedback,
      corrected: g.corrected,
      ai: true,
    };

    task.attemptCount += 1;
    task.bestScore = Math.max(task.bestScore ?? 0, score);
    if (result.passed && !task.passedAt) task.passedAt = new Date();
    task.lastSummary = summary;
    task.lastGrade = { ...result, questionsCorrect: questionsCorrect ?? null };
    await this.tasks.save(task);
    return { ...result, bestScore: task.bestScore };
  }

  /** Planned passage length: grows with the lesson's place among the level's taught lessons. */
  private async targetFor(lesson: CourseLesson): Promise<number> {
    const unitPos = new Map(
      (await this.units.find({ where: { level: lesson.level }, select: ['id', 'position'] })).map((u) => [u.id, u.position]),
    );
    const rows = await this.lessons.find({
      where: { level: lesson.level, kind: LessonKind.LESSON },
      select: ['id', 'unitId', 'position'],
    });
    rows.sort((a, b) => (unitPos.get(a.unitId) ?? 0) - (unitPos.get(b.unitId) ?? 0) || a.position - b.position);
    const n = Math.max(0, rows.findIndex((r) => r.id === lesson.id));
    return listeningTarget(lesson.level, n, Math.max(rows.length, UNITS_PER_LEVEL * LESSONS_PER_UNIT));
  }

  private async lessonOrThrow(id: string): Promise<CourseLesson> {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson || lesson.kind !== LessonKind.LESSON) throw new NotFoundException('Lesson not found');
    if (lesson.status !== LessonStatus.READY) throw new BadRequestException('Bài học chưa soạn xong');
    return lesson;
  }
}
