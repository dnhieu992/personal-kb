import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, Env } from '../../../platform/config/config';
import { AiGateway } from '../../../platform/ai/ai.gateway';
import { CefrLevel } from '../shared/cefr';
import { ALL_POINTS, frameworkFor } from './syllabus';
import {
  Exercise,
  ExerciseType,
  LessonContent,
  LessonSpec,
  LESSONS_PER_UNIT,
  LevelOutline,
  IdeaVerdict,
  ListeningContent,
  ListeningIdea,
  UNITS_PER_LEVEL,
} from './course.types';

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
      type: { type: 'string', enum: ['mcq', 'gap', 'order', 'match', 'fix', 'listen', 'read', 'write'] },
      passage: str,
      prompt: str,
      options: strList,
      answer: strList,
      pairs: { type: 'array', items: obj({ left: str, right: str }) },
      explanation: str,
    }),
  },
  minutes: { type: 'integer' },
});

const SKILLS_SCHEMA = obj({ exercises: (LESSON_SCHEMA.properties as Record<string, unknown>).exercises });

const GRADE_SCHEMA = obj({
  score: { type: 'integer' },
  feedback: str,
  corrected: str,
});

const LISTENING_SCHEMA = obj({
  title: str,
  context: str,
  passage: str,
  translation: str,
  questions: { type: 'array', items: obj({ question: str, options: strList, answer: str, explanation: str }) },
  ideas: { type: 'array', items: obj({ idea: str, vi: str }) },
});

const SUMMARY_SCHEMA = obj({
  ideas: {
    type: 'array',
    items: obj({ index: { type: 'integer' }, status: { type: 'string', enum: ['covered', 'partial', 'missing'] }, note: str }),
  },
  feedback: str,
  corrected: str,
});

/** Judging which ideas a summary covers needs care (paraphrase, partial credit): a mid-size model. */
const SUMMARY_MODEL = 'claude-sonnet-5-5';

const wordsIn = (s: string) => (s.match(/[A-Za-z0-9'’-]+/g) ?? []).length;

/** Grading one written answer is quick and frequent: a small model is plenty. */
const GRADE_MODEL = 'claude-haiku-5-5';

/** How to write the skill exercises; shared by full lessons and the top-up of older ones. */
const SKILL_RULES =
  '  • listen (dictation): passage = ONE natural sentence someone says at work (8–16 words, uses the lesson\'s ' +
  'grammar or vocab) — the app reads it aloud and hides it; prompt = ""; options = []; answer = [the sentence exactly ' +
  'as in passage, plus a variant with/without contractions if both are fine].\n' +
  '  • listen (choice): passage = a short spoken message, 2–4 sentences (a stand-up update, a voicemail, a meeting ' +
  'remark); prompt = one question about it (in English); options = exactly 4; answer = [the correct option]. ' +
  'The answer must need listening, not guessing.\n' +
  '  • read: passage = ONE realistic work text of 90–150 words (email, Slack thread, Jira ticket, PR description, ' +
  'doc excerpt) using the lesson\'s grammar and vocab; write 3 read items that share the SAME passage text ' +
  '(copy it exactly into each), each with a different question (gist, detail, inference) and exactly 4 options; ' +
  'answer = [the correct option].\n' +
  '  • write: prompt = a Vietnamese task describing a concrete work situation and what to write ' +
  '(1–2 English sentences), naming the structure to use (e.g. "Nhắn Slack báo team bạn đã deploy bản fix, dùng ' +
  'hiện tại hoàn thành"); answer = 2–3 good model answers; options = []; explanation = what a good answer must contain.\n' +
  '  • passage = "" for every non-listen/read type.\n';

/** Writes the English-for-IT course: a level's syllabus, then each lesson. */
@Injectable()
export class CourseAiService {
  private readonly logger = new Logger(CourseAiService.name);
  private readonly model: string;

  constructor(
    @Inject(ENV) env: Env,
    private readonly ai: AiGateway,
  ) {
    this.model = env.COURSE_MODEL || DEFAULT_MODEL;
  }

  isEnabled(): boolean {
    return this.ai.isEnabled();
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
      '- exercises: 19–21 items testing THIS lesson\'s grammar and vocab, in this order: ' +
      'drills easy → hard (3 mcq, 2 gap, 3 order, 1 match, 2 fix), then listening (2 listen dictation, ' +
      '1 listen choice), then reading (3 read on one passage), then writing (2 write). ' +
      'Every field must be present; use [] / "" for fields a type does not use.\n' +
      '  • mcq: prompt = question or sentence with ___; options = exactly 4; answer = [the correct option, copied exactly]. ' +
      'Exactly one option is correct; distractors are clearly wrong for a stated reason.\n' +
      '  • gap: prompt = one sentence containing ___ exactly once (add the base verb in brackets when testing a form, e.g. "(fix)"); ' +
      'answer = every acceptable fill (include contracted and full forms when both are right); options = [].\n' +
      '  • order: options = the words of ONE correct sentence, in the correct order (the app shuffles them); ' +
      'keep punctuation attached to its word; 5–12 words; the order must be unambiguous. answer = [the full sentence].\n' +
      '  • match: pairs = 5 vocabulary items from this lesson, left = English, right = Vietnamese meaning. prompt = a short Vietnamese instruction.\n' +
      '  • fix: prompt = one sentence with exactly ONE grammar mistake about this lesson\'s point; ' +
      'answer = the corrected full sentence(s) (all acceptable corrections). options = [].\n' +
      SKILL_RULES +
      '  • explanation (all types): 1–2 Vietnamese sentences on why the answer is right.\n' +
      '- minutes: realistic estimate to read the theory and do the practice (15–30).\n' +
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

  /**
   * Listening, reading, writing and extra word-order items for a lesson written
   * before they existed; appended to its exercises.
   */
  async generateSkills(spec: LessonSpec, vocab: string[]): Promise<Exercise[]> {
    const system =
      'You write practice for "English for IT", a self-study course. ' +
      AUDIENCE +
      '\n\nThe lesson described by the user already has its theory and grammar drills. Add skill practice at CEFR ' +
      spec.level +
      ', reusing the lesson\'s grammar point and vocabulary: exactly 2 order, 2 listen dictation, 1 listen choice, ' +
      '3 read (one shared passage), 2 write — 10 items, in that order. Every field must be present; ' +
      'use [] / "" for fields a type does not use.\n' +
      '  • order: options = the words of ONE correct sentence, in the correct order (the app shuffles them); ' +
      'keep punctuation attached to its word; 7–14 words; the order must be unambiguous. answer = [the full sentence]. ' +
      'prompt = the Vietnamese meaning.\n' +
      SKILL_RULES +
      '  • explanation (all types): 1–2 Vietnamese sentences on why the answer is right.\n' +
      'Double-check every answer key.';
    const user =
      `Unit: ${spec.unitTitle} — ${spec.unitSummary}\n` +
      `Lesson: ${spec.title}\nGrammar point: ${spec.grammar}\nVocabulary theme: ${spec.vocabTheme}\n` +
      `Lesson vocabulary: ${vocab.join(', ')}\nObjective: ${spec.objective}`;
    const raw = await this.call<{ exercises: Exercise[] }>(system, user, SKILLS_SCHEMA, 'medium');
    const out = (raw.exercises ?? []).map((e) => normaliseExercise(e)).filter((e): e is Exercise => !!e);
    if (out.length < 6) throw new Error(`only ${out.length} valid skill exercises`);
    return out;
  }

  /** Grade one written answer against the task and model answers. */
  async gradeWriting(input: {
    level: string;
    task: string;
    models: string[];
    criteria: string;
    text: string;
  }): Promise<{ score: number; feedback: string; corrected: string }> {
    const system =
      'You grade short written answers in "English for IT", a course for a Vietnamese software engineer at CEFR ' +
      input.level +
      '. Judge whether the answer does the task with correct, natural English and uses the required structure. ' +
      'Model answers are examples, not the only right answers — any correct, natural answer that fits the task ' +
      'deserves full marks. Small typos cost a little; wrong grammar for the required structure costs a lot; ' +
      'off-task answers score low.\n' +
      'score: 0–100. feedback: 1–3 short Vietnamese sentences: what is good, the main mistake and how to fix it. ' +
      'corrected: the learner\'s answer with mistakes fixed, changed as little as possible (copy it unchanged if it is right).';
    const user =
      `Task (Vietnamese): ${input.task}\nWhat a good answer contains: ${input.criteria}\n` +
      `Model answers: ${input.models.join(' | ')}\n\nLearner's answer: ${input.text}`;
    const { data } = await this.ai.ask<{ score: number; feedback: string; corrected: string }>({
      module: 'english',
      purpose: 'course.grade-writing',
      model: GRADE_MODEL,
      system,
      user,
      schema: GRADE_SCHEMA,
      timeoutMs: 90_000,
    });
    if (!data) throw new Error('no grade');
    return {
      score: Math.max(0, Math.min(100, Math.round(data.score))),
      feedback: data.feedback ?? '',
      corrected: data.corrected ?? '',
    };
  }

  /**
   * A listening task for a lesson: a spoken passage of about `words` words,
   * comprehension questions and the key ideas a summary is graded against.
   */
  async generateListening(spec: LessonSpec, vocab: string[], words: number): Promise<ListeningContent> {
    const questions = Math.min(8, 4 + Math.floor((words - 100) / 100));
    const ideas = Math.min(9, 4 + Math.round(words / 100));
    const system =
      'You write listening practice for "English for IT", a self-study course. ' +
      AUDIENCE +
      ' Their listening is weak, so the text must be clear, natural spoken English at CEFR ' +
      spec.level +
      ' (vocabulary and sentence length at that level; at A2/B1 keep sentences short).\n\n' +
      'Write ONE listening task tied to the lesson described by the user.\n' +
      `- passage: about ${words} words (stay within ±10%). ONE speaker talking (the app reads it aloud with a single ` +
      'browser voice): e.g. a stand-up update, a team lead briefing, an onboarding talk, a voicemail, an incident ' +
      'debrief, a short tech talk, a demo walkthrough. Spoken style (contractions, signposting like "first", "so", ' +
      '"the main thing is"), no speaker labels, no headings, no bullet points, no markdown, no URLs or code. ' +
      'Write numbers, versions and times the way they are said aloud ("version two point three", "half past ten"). ' +
      'Paragraphs separated by a blank line. Use the lesson\'s grammar point naturally several times and some of its ' +
      'vocabulary. It must have a clear structure and distinct main points, so it can be summarised.\n' +
      '- title: short English title. context: one Vietnamese sentence saying who is speaking, to whom and why ' +
      '(shown before listening; must not give away the answers).\n' +
      '- translation: a natural Vietnamese translation of the passage, same paragraphs.\n' +
      `- questions: exactly ${questions} multiple-choice questions in English, in the order the information appears: ` +
      'gist first, then details (who/what/when/why/numbers), and at least one inference. options = exactly 4 plausible ' +
      'options of similar length; answer = the correct option copied exactly; the answer must come from listening, not ' +
      'common sense. explanation = 1–2 Vietnamese sentences quoting what the speaker said.\n' +
      `- ideas: the ${ideas} main ideas of the passage, in order, together covering everything a good summary should ` +
      'say (not tiny details). idea = one short English sentence; vi = its Vietnamese meaning.\n' +
      'Double-check every answer key against the passage.';
    const user =
      `Unit: ${spec.unitTitle} — ${spec.unitSummary}\nLesson: ${spec.title}\nGrammar point: ${spec.grammar}\n` +
      `Vocabulary theme: ${spec.vocabTheme}\nLesson vocabulary: ${vocab.join(', ')}\nObjective: ${spec.objective}`;
    const raw = await this.call<ListeningContent>(system, user, LISTENING_SCHEMA, 'medium');
    const passage = String(raw.passage ?? '').trim();
    const count = wordsIn(passage);
    if (count < words * 0.6) throw new Error(`passage too short (${count} words, wanted ${words})`);
    const qs = (raw.questions ?? [])
      .map((q) => ({
        question: String(q.question ?? '').trim(),
        options: (q.options ?? []).map((o) => String(o ?? '').trim()).filter(Boolean),
        answer: String(q.answer ?? '').trim(),
        explanation: String(q.explanation ?? '').trim(),
      }))
      .filter((q) => q.question && q.options.length >= 2 && q.options.includes(q.answer));
    const keyIdeas = (raw.ideas ?? [])
      .map((i) => ({ idea: String(i.idea ?? '').trim(), vi: String(i.vi ?? '').trim() }))
      .filter((i) => i.idea);
    if (qs.length < 3) throw new Error(`only ${qs.length} valid questions`);
    if (keyIdeas.length < 3) throw new Error(`only ${keyIdeas.length} key ideas`);
    return {
      title: String(raw.title ?? '').trim() || spec.title,
      context: String(raw.context ?? '').trim(),
      passage,
      translation: String(raw.translation ?? '').trim(),
      questions: qs,
      ideas: keyIdeas,
    };
  }

  /** Which of the passage's key ideas a learner's summary covers. */
  async gradeSummary(input: {
    level: string;
    passage: string;
    ideas: ListeningIdea[];
    summary: string;
  }): Promise<{ ideas: IdeaVerdict[]; feedback: string; corrected: string }> {
    const system =
      'You grade summaries in "English for IT", a course for a Vietnamese software engineer at CEFR ' +
      input.level +
      ' whose listening is weak. They listened (audio only) to the passage below and wrote a summary from memory.\n' +
      'For EACH key idea (by its 0-based index) decide: covered = the summary states it (any wording, paraphrase ' +
      'or simpler words are fine); partial = only part of it, or vague but clearly about it; missing = absent or ' +
      'wrong (contradicts the passage). Grade understanding, not language: grammar and spelling mistakes never ' +
      'lower a verdict if the meaning is clear. Do not give credit for invented facts. note = a few Vietnamese ' +
      'words on what was said or missed.\n' +
      'feedback: 2–4 short Vietnamese sentences: what they understood well, the most important thing they missed or ' +
      'got wrong, and one tip on the English of the summary. If the summary is not in English, still grade the ideas ' +
      'but remind them to write in English.\n' +
      'corrected: their summary rewritten in correct, natural English, keeping their ideas and changing as little as ' +
      'possible (do not add missing ideas).';
    const user =
      `Passage:\n${input.passage}\n\nKey ideas:\n` +
      input.ideas.map((i, n) => `${n}. ${i.idea}`).join('\n') +
      `\n\nLearner's summary:\n${input.summary}`;
    const { data } = await this.ai.ask<{ ideas: IdeaVerdict[]; feedback: string; corrected: string }>({
      module: 'english',
      purpose: 'course.grade-summary',
      model: SUMMARY_MODEL,
      system,
      user,
      schema: SUMMARY_SCHEMA,
      timeoutMs: 120_000,
    });
    if (!data) throw new Error('no grade');
    return { ideas: data.ideas ?? [], feedback: data.feedback ?? '', corrected: data.corrected ?? '' };
  }

  /** One structured-output call through headless Claude Code, parsed as JSON. */
  private async call<T>(
    system: string,
    user: string,
    schema: object,
    effort: 'medium' | 'high',
  ): Promise<T> {
    const { data } = await this.ai.ask<T>({ module: 'english', purpose: 'course.generate', model: this.model, system, user, schema, effort });
    if (!data || typeof data !== 'object') throw new Error('no structured reply');
    return data;
  }
}

const TYPES: ExerciseType[] = ['mcq', 'gap', 'order', 'match', 'fix', 'listen', 'read', 'write'];
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
    passage: String(e.passage ?? '').trim(),
  };
  if (ex.type !== 'listen' && ex.type !== 'read') ex.passage = '';
  switch (ex.type) {
    case 'listen':
      if (!ex.passage) return null;
      if (ex.options.length) return ex.prompt && ex.options.includes(ex.answer[0]) ? ex : null;
      // Dictation: the spoken sentence is always an accepted transcript.
      ex.answer = [...new Set([ex.passage, ...ex.answer])];
      return ex;
    case 'read':
      return ex.passage && ex.prompt && ex.options.length >= 2 && ex.options.includes(ex.answer[0]) ? ex : null;
    case 'write':
      return ex.prompt && ex.answer.length ? ex : null;
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
