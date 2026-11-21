import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';
import {
  Exercise,
  ExerciseType,
  LessonContent,
  LessonSpec,
  LevelOutline,
} from '../course/course.types';

/**
 * Course content is written once and kept, so it gets the strongest model
 * (override with COURSE_MODEL); day-to-day calls elsewhere stay on Haiku.
 */
const DEFAULT_MODEL = 'claude-opus-5-5';
/** Server-side refusal fallback (on by default for this model family). */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const UNITS_PER_LEVEL = 8;
export const LESSONS_PER_UNIT = 4;
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
        items: obj({ title: str, grammar: str, vocabTheme: str, objective: str }),
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
  private readonly client: Anthropic;
  private readonly enabled: boolean;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.enabled = !!apiKey;
    this.client = new Anthropic({ apiKey: apiKey ?? 'missing' });
    this.model = config.get<string>('COURSE_MODEL') || DEFAULT_MODEL;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** The syllabus for one level: 8 units × 4 lessons. */
  async generateOutline(level: CefrLevel): Promise<LevelOutline> {
    const system =
      'You design "English for IT", a self-study course. ' +
      AUDIENCE +
      '\n\nWrite the syllabus for CEFR level ' +
      level +
      `: exactly ${UNITS_PER_LEVEL} units, each with exactly ${LESSONS_PER_UNIT} lessons.\n` +
      '- Units are workplace situations, ordered from everyday to more demanding.\n' +
      `- Grammar: together the ${UNITS_PER_LEVEL * LESSONS_PER_UNIT} lessons cover the core ` +
      `${level} grammar syllabus in a sensible progression. One focused grammar point ` +
      'per lesson, no point repeated, each one useful in that unit\'s situation.\n' +
      '- Each lesson also has a vocabulary theme (≈10 words) tied to the situation.\n' +
      '- title: short, English. titleVi: the unit title in Vietnamese. ' +
      'summary: one Vietnamese sentence on what the unit covers. ' +
      'grammar: the grammar point in English (e.g. "Present perfect vs past simple"). ' +
      'objective: one Vietnamese sentence starting "Sau bài này bạn có thể".';
    const outline = await this.call<LevelOutline>(
      system,
      `Write the ${level} syllabus.`,
      OUTLINE_SCHEMA,
      'high',
      16_000,
    );
    const units = (outline.units ?? []).filter((u) => u.title && u.lessons?.length);
    if (units.length < 4) throw new Error(`outline has only ${units.length} units`);
    return { units };
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
      `Vocabulary theme: ${spec.vocabTheme}\n` +
      `Objective: ${spec.objective}\n\n` +
      'Grammar taught in other lessons of this level (do not teach these here, ' +
      'though you may use them in examples):\n' +
      spec.otherGrammar.map((g) => `- ${g}`).join('\n');
    const raw = await this.call<LessonContent>(system, user, LESSON_SCHEMA, 'medium', 32_000);
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

  /** One structured-output call, streamed (long outputs), parsed as JSON. */
  private async call<T>(
    system: string,
    user: string,
    schema: object,
    effort: 'medium' | 'high',
    maxTokens: number,
  ): Promise<T> {
    if (!this.enabled) throw new Error('ANTHROPIC_API_KEY is not set');
    // The installed SDK predates these request fields in its types; the API
    // accepts them, and the SDK passes the body through as-is.
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort, format: { type: 'json_schema', schema } },
      fallbacks: 'default',
    } as unknown as Anthropic.MessageCreateParamsNonStreaming;
    const message = await this.client.messages
      .stream(body, { headers: { 'anthropic-beta': FALLBACK_BETA } })
      .finalMessage();
    const stop = message.stop_reason as string;
    if (stop === 'refusal') throw new Error('the model declined to write this');
    if (stop === 'max_tokens') throw new Error('reply was cut off (max_tokens)');
    const text = message.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('no text in reply');
    this.logger.log(
      `${this.model}: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`,
    );
    return JSON.parse(text.text) as T;
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
    case 'gap':
      return ex.prompt.includes('___') && ex.answer.length ? ex : null;
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
