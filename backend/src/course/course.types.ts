import { CefrLevel } from '../knowledge/entities/knowledge.entity';

/** Levels the course is built for, in study order. */
export const COURSE_LEVELS: CefrLevel[] = [
  CefrLevel.A2,
  CefrLevel.B1,
  CefrLevel.B2,
  CefrLevel.C1,
];

/** Score (0–100) a lesson's practice needs to count as done and unlock the next one. */
export const LESSON_PASS_SCORE = 70;

/** Score a quick check (lesson already mastered in the placement test) needs. */
export const QUICK_CHECK_PASS_SCORE = 80;

/** Score a unit review (mixed exercises from every lesson of the unit) needs. */
export const REVIEW_PASS_SCORE = 80;

/** A level's planned size: units × lessons, plus one review per unit. */
export const UNITS_PER_LEVEL = 12;
export const LESSONS_PER_UNIT = 5;
export const PLANNED_PER_LEVEL = UNITS_PER_LEVEL * (LESSONS_PER_UNIT + 1);

/** Pace target when no goal has been set. */
export const DEFAULT_WEEKLY_LESSONS = 5;

export type ExerciseType = 'mcq' | 'gap' | 'order' | 'match' | 'fix' | 'listen' | 'read' | 'write';

/** Version of the exercise mix; lessons below it get the skills top-up (listen/read/write). */
export const SKILLS_VERSION = 1;

/**
 * One auto-graded exercise. A single flat shape (unused fields are empty) so it
 * maps 1:1 onto the JSON schema the model fills in:
 * - mcq:   `options` (4), `answer[0]` = the correct option
 * - gap:   `prompt` has one `___`, `answer` = every accepted fill
 * - order: `options` = the sentence's words IN ORDER (the UI shuffles), `answer[0]` = the sentence
 * - match: `pairs` = English ↔ Vietnamese
 * - fix:   `prompt` = sentence with one mistake, `answer` = accepted corrected sentences
 * - listen: `passage` = what the browser reads aloud (hidden). With `options`: a question
 *           (`prompt`) answered by choice, `answer[0]`. Without: dictation, `answer` = accepted transcripts
 * - read:  `passage` = a short work text, `prompt` = question, `options` (3–4), `answer[0]`
 * - write: `prompt` = Vietnamese task, `answer` = model answers; graded by AI (`/course/lessons/:id/grade`)
 */
export interface Exercise {
  type: ExerciseType;
  prompt: string;
  options: string[];
  answer: string[];
  pairs: { left: string; right: string }[];
  explanation: string;
  /** listen / read only ('' elsewhere; absent on exercises written before they existed). */
  passage?: string;
}

export interface VocabItem {
  word: string;
  ipa: string;
  pos: string;
  meaning: string;
  example: string;
}

export interface UsefulPhrase {
  en: string;
  vi: string;
}

/** What the model writes for one lesson. */
export interface LessonContent {
  intro: string;
  theory: string;
  phrases: UsefulPhrase[];
  vocab: VocabItem[];
  exercises: Exercise[];
  minutes: number;
}

/** The syllabus for one level: units, each with its planned lessons. */
export interface LevelOutline {
  units: {
    title: string;
    titleVi: string;
    summary: string;
    lessons: {
      title: string;
      grammar: string;
      vocabTheme: string;
      objective: string;
      syllabusKeys: string[];
    }[];
  }[];
}

/** What a lesson is about, handed to the model when writing it. */
export interface LessonSpec {
  level: CefrLevel;
  unitTitle: string;
  unitSummary: string;
  title: string;
  grammar: string;
  vocabTheme: string;
  objective: string;
  /** Names of the Core Inventory points it covers. */
  syllabus: string[];
  /** Grammar points of the other lessons in the level, so this one stays in its lane. */
  otherGrammar: string[];
}

/** Share of a passage's key ideas a summary must cover to pass the listening task. */
export const LISTENING_PASS_SCORE = 60;

/** Passage length range (words) per level; it grows across the level's lessons. */
export const LISTENING_WORDS: Record<string, [number, number]> = {
  A2: [100, 180],
  B1: [180, 280],
  B2: [280, 400],
  C1: [380, 500],
};

/** Words the listening passage of the n-th lesson (0-based) of `total` in a level should have. */
export function listeningTarget(level: string, n: number, total: number): number {
  const [lo, hi] = LISTENING_WORDS[level] ?? [100, 180];
  const t = total > 1 ? Math.min(1, Math.max(0, n / (total - 1))) : 0;
  return Math.round((lo + (hi - lo) * t) / 10) * 10;
}

/** One comprehension question on the listening passage (multiple choice). */
export interface ListeningQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

/** One main idea of the passage: what a summary has to say. */
export interface ListeningIdea {
  idea: string;
  /** Vietnamese, shown after grading. */
  vi: string;
}

/** What the model writes for a listening task. */
export interface ListeningContent {
  title: string;
  context: string;
  passage: string;
  translation: string;
  questions: ListeningQuestion[];
  ideas: ListeningIdea[];
}

/** How a summary covered one idea. */
export interface IdeaVerdict {
  index: number;
  status: 'covered' | 'partial' | 'missing';
  note: string;
}

export interface SummaryGrade {
  score: number;
  passed: boolean;
  ideas: (IdeaVerdict & ListeningIdea)[];
  feedback: string;
  corrected: string;
  ai: boolean;
}
