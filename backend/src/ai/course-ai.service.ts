import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeCodeService } from './claude-code.service';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';
import { ALL_POINTS, frameworkFor } from '../course/syllabus';
import {
  Exercise,
  ExerciseType,
  LessonContent,
  LessonSpec,
  LESSONS_PER_UNIT,
  LevelOutline,
  UNITS_PER_LEVEL,
} from '../course/course.types';

/**
 * Course content is written once and kept, so it gets the strongest model
 * (override with COURSE_MODEL); day-to-day calls elsewhere stay on Haiku.
 */
const DEFAULT_MODEL = 'claude-opus-5-5';

const MIN_EXERCISES = 8;

const AUDIENCE =
  'The learner is a Vietnamese software engineer studying on their own to use ' +
  'English at work: stand-ups, Jira tickets, Slack, code review, emails, meetings, ' +
  'documentation, incidents, interviews. Every example and exercise is set in that ' +
  'world (realistic names, products, tickets, PRs), never generic textbook topics.';

const str = { type: 'string' } as const;
const strList = { type: 'array', items: str } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const OUTLINE_SCHEMA = obj({
  units: {
    type: 'array',
    items: obj({
      title: str,
      titleVi: str,
      summary: str,
      lessons: {
        type: 'array',
        items: obj({
          title: str,
          grammar: str,
          vocabTheme: str,
          objective: str,
          syllabusKeys: { type: 'array', items: { type: 'string', enum: ALL_POINTS.map((p) => p.key) } },
        }),
      },
    }),
  },
});

const LESSON_SCHEMA = obj({
  intro: str,
  theory: str,
  phrases: { type: 'array', items: obj({ en: str, vi: str }) },
  vocab: {
    type: 'array',
    items: obj({ word: str, ipa: str, pos: str, meaning: str, example: str }),
  },
  exercises: {
    type: 'array',
    items: obj({
      type: { type: 'string', enum: ['mcq', 'gap', 'order', 'match', 'fix'] },
      prompt: str,
      options: strList,
      answer: strList,
      pairs: { type: 'array', items: obj({ left: str, right: str }) },
      explanation: str,
    }),
  },
  minutes: { type: 'integer' },
});

/** Writes the English-for-IT course: a level's syllabus, then each lesson. */
@Injectable()
export class CourseAiService {
  private readonly logger = new Logger(CourseAiService.name);
  private readonly model: string;

  constructor(
    config: ConfigService,
    private readonly claude: ClaudeCodeService,
  ) {
    this.model = config.get<string>('COURSE_MODEL') || DEFAULT_MODEL;
  }

  isEnabled(): boolean {
    return this.claude.isEnabled();
  }

  /**
   * The syllabus for one level: UNITS_PER_LEVEL units × LESSONS_PER_UNIT lessons.
   * With `existing`, the level already has some units: write only the missing
   * ones, continuing the progression and favouring points not taught yet.
   */
  async generateOutline(
    level: CefrLevel,
    existing?: { units: { title: string; grammar: string[] }[]; uncovered: string[] },
  ): Promise<LevelOutline> {
    const count = UNITS_PER_LEVEL - (existing?.units.length ?? 0);
    const lessons = count * LESSONS_PER_UNIT;
    const system =
      'You design "English for IT", a self-study course. ' +
      AUDIENCE +
      '\n\nWrite the syllabus for CEFR level ' +
      level +
      `: exactly ${count} units, each with exactly ${LESSONS_PER_UNIT} lessons.\n` +
      '- Units are workplace situations, ordered from everyday to more demanding.\n' +
      `- Grammar: together the lessons cover the core ${level} grammar syllabus in a sensible ` +
      'progression. One focused grammar point per lesson, each one useful in that unit\'s situation. ' +
      'A big point may get a second lesson from a different angle (form vs use, a harder context), ' +
      'but never the same lesson twice.\n' +
      '- Each lesson also has a vocabulary theme (≈10 words) tied to the situation.\n' +
      '- title: short, English. titleVi: the unit title in Vietnamese. ' +
      'summary: one Vietnamese sentence on what the unit covers. ' +
      'grammar: the grammar point in English (e.g. "Present perfect vs past simple"). ' +
      'objective: one Vietnamese sentence starting "Sau bài này bạn có thể".\n' +
      '- syllabusKeys: the key(s) of the reference-syllabus point(s) the lesson teaches (usually one). ' +
      'Use [] only for a workplace extra that is not on the list.' +
      this.syllabusBrief(level) +
      (existing
        ? '\n\nThe level ALREADY HAS these units (do not repeat their situations or lessons; ' +
          `continue after them — your ${count} units come next, slightly more demanding):\n` +
          existing.units.map((u, i) => `${i + 1}. ${u.title} — ${u.grammar.join('; ')}`).join('\n') +
          (existing.uncovered.length
            ? '\nReference points with no lesson yet (teach each of these first): ' +
              existing.uncovered.join(', ')
            : '')
        : '');
    const outline = await this.call<LevelOutline>(
      system,
      existing
        ? `Write the next ${count} units (${lessons} lessons) of the ${level} syllabus.`
        : `Write the ${level} syllabus.`,
      OUTLINE_SCHEMA,
      'high',
    );
    const units = (outline.units ?? []).filter((u) => u.title && u.lessons?.length);
    if (units.length < Math.min(4, count)) throw new Error(`outline has only ${units.length} units`);
    return { units: units.slice(0, count) };
  }

  /**
   * The level's reference syllabus (British Council – EAQUALS Core Inventory),
   * which the outline must cover, plus the workplace goals to aim the units at.
   */
  private syllabusBrief(level: CefrLevel): string {
    const f = frameworkFor(level);
    if (!f) return '';
    return (
      '\n\nReference syllabus — British Council – EAQUALS Core Inventory, ' + level + '. ' +
      'Every point below MUST be taught by at least one lesson (put its key in syllabusKeys). ' +
      'Use the remaining lessons for the most useful workplace points (they may review a lower ' +
      'level\'s key or be extras), never for content above ' + level + '.\n' +
      f.points.map((p) => `- ${p.key}: ${p.name}`).join('\n') +
      '\n\nFunctions to practise across the units: ' + f.functions.join('; ') + '.' +
      '\nWorkplace goals for the level (Vietnamese): ' + f.canDo.join('; ') + '.' +
      '\nKeys from lower levels you may reuse for review: ' +
      ALL_POINTS.filter((p) => p.level < level).map((p) => p.key).join(', ')
    );
  }

  /** Theory, vocabulary and practice for one lesson. */
  async generateLesson(spec: LessonSpec): Promise<LessonContent> {
    const system =
      'You write lessons for "English for IT", a self-study course. ' +
      AUDIENCE +
      '\n\nWrite the full lesson described by the user, at CEFR ' +
      spec.level +
      ' (English in examples and exercises must be at that level).\n\n' +
      'Fields:\n' +
      '- intro: 1–2 Vietnamese sentences: what this lesson is for and when it is needed at work.\n' +
      '- theory: Markdown, explanations in Vietnamese, examples in English. No H1. ' +
      'Sections: "## Khi nào dùng", "## Cấu trúc" (formulas/table), ' +
      '"## Ví dụ trong công việc" (5–6 English examples, each followed by its Vietnamese meaning in italics), ' +
      '"## Lỗi hay gặp" (2–4 mistakes Vietnamese speakers really make, as ❌ wrong / ✅ right with a short why). ' +
      'About 350–600 words. Clear and practical, not academic.\n' +
      '- phrases: 5–6 ready-to-use workplace sentences or chunks using this lesson\'s grammar/vocab (en + vi).\n' +
      '- vocab: exactly 10 items for the vocabulary theme: word (or short phrase), ipa (American, with slashes), ' +
      'pos (noun/verb/adj/adv/phrase…), meaning (Vietnamese), example (one English sentence from work).\n' +
      '- exercises: 12–14 items, easy → hard, testing THIS lesson\'s grammar and vocab: ' +
      'about 4 mcq, 3 gap, 2 order, 1 match, 2 fix. Every field must be present; use [] for fields a type does not use.\n' +
      '  • mcq: prompt = question or sentence with ___; options = exactly 4; answer = [the correct option, copied exactly]. ' +
      'Exactly one option is correct; distractors are clearly wrong for a stated reason.\n' +
      '  • gap: prompt = one sentence containing ___ exactly once (add the base verb in brackets when testing a form, e.g. "(fix)"); ' +
      'answer = every acceptable fill (include contracted and full forms when both are right); options = [].\n' +
      '  • order: options = the words of ONE correct sentence, in the correct order (the app shuffles them); ' +
      'keep punctuation attached to its word; 5–12 words; the order must be unambiguous. answer = [the full sentence].\n' +
      '  • match: pairs = 5 vocabulary items from this lesson, left = English, right = Vietnamese meaning. prompt = a short Vietnamese instruction.\n' +
      '  • fix: prompt = one sentence with exactly ONE grammar mistake about this lesson\'s point; ' +
      'answer = the corrected full sentence(s) (all acceptable corrections). options = [].\n' +
      '  • explanation (all types): 1–2 Vietnamese sentences on why the answer is right.\n' +
      '- minutes: realistic estimate to read the theory and do the practice (10–25).\n' +
      'Double-check every answer before finishing: a wrong answer key teaches the learner the wrong thing.';
    const user =
      `Unit: ${spec.unitTitle} — ${spec.unitSummary}\n` +
      `Lesson: ${spec.title}\n` +
      `Grammar point: ${spec.grammar}\n` +
      (spec.syllabus.length
        ? `Reference syllabus point(s) (British Council – EAQUALS Core Inventory): ${spec.syllabus.join('; ')}\n`
        : '') +
      `Vocabulary theme: ${spec.vocabTheme}\n` +
      `Objective: ${spec.objective}\n\n` +
      'Grammar taught in other lessons of this level (do not teach these here, ' +
      'though you may use them in examples):\n' +
      spec.otherGrammar.map((g) => `- ${g}`).join('\n');
    const raw = await this.call<LessonContent>(system, user, LESSON_SCHEMA, 'medium');
    const exercises = (raw.exercises ?? [])
      .map((e) => normaliseExercise(e))
      .filter((e): e is Exercise => !!e);
    if (exercises.length < MIN_EXERCISES) {
      throw new Error(`only ${exercises.length} valid exercises`);
    }
    if (!raw.theory?.trim()) throw new Error('empty theory');
    return {
      intro: raw.intro ?? '',
      theory: raw.theory,
      phrases: (raw.phrases ?? []).filter((p) => p.en),
      vocab: (raw.vocab ?? []).filter((v) => v.word && v.meaning),
      exercises,
      minutes: Math.min(40, Math.max(5, Math.round(raw.minutes || 15))),
    };
  }

  /** One structured-output call through headless Claude Code, parsed as JSON. */
  private async call<T>(
    system: string,
    user: string,
    schema: object,
    effort: 'medium' | 'high',
  ): Promise<T> {
    const { data } = await this.claude.ask<T>({ model: this.model, system, user, schema, effort });
    if (!data || typeof data !== 'object') throw new Error('no structured reply');
    return data;
  }
}

const TYPES: ExerciseType[] = ['mcq', 'gap', 'order', 'match', 'fix'];
const clean = (list: unknown): string[] =>
  Array.isArray(list)
    ? list.map((s) => String(s ?? '').trim()).filter(Boolean)
    : [];

/** Make one exercise self-consistent, or drop it (null) when it can't be graded. */
export function normaliseExercise(e: Partial<Exercise>): Exercise | null {
  if (!e || !TYPES.includes(e.type as ExerciseType)) return null;
  const ex: Exercise = {
    type: e.type as ExerciseType,
    prompt: String(e.prompt ?? '').trim(),
    options: clean(e.options),
    answer: clean(e.answer),
    pairs: Array.isArray(e.pairs)
      ? e.pairs
          .map((p) => ({ left: String(p?.left ?? '').trim(), right: String(p?.right ?? '').trim() }))
          .filter((p) => p.left && p.right)
      : [],
    explanation: String(e.explanation ?? '').trim(),
  };
  switch (ex.type) {
    case 'mcq':
      if (ex.options.length < 2 || !ex.answer.length) return null;
      // The key must be one of the options, or nothing could ever be marked right.
      return ex.options.includes(ex.answer[0]) ? ex : null;
    case 'gap': {
      // The model sometimes draws the blank longer (_____); the UI splits on ___.
      const prompt = ex.prompt.replace(/_{4,}/g, '___');
      return prompt.includes('___') && ex.answer.length ? { ...ex, prompt } : null;
    }
    case 'order':
      // The words, in order, are the key; keep `answer` in step with them.
      if (ex.options.length < 3) return null;
      ex.answer = [ex.options.join(' ')];
      return ex;
    case 'match':
      return ex.pairs.length >= 3 ? ex : null;
    case 'fix':
      return ex.prompt && ex.answer.length ? ex : null;
  }
}
