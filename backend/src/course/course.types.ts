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

export type ExerciseType = 'mcq' | 'gap' | 'order' | 'match' | 'fix';

/**
 * One auto-graded exercise. A single flat shape (unused fields are empty) so it
 * maps 1:1 onto the JSON schema the model fills in:
 * - mcq:   `options` (4), `answer[0]` = the correct option
 * - gap:   `prompt` has one `___`, `answer` = every accepted fill
 * - order: `options` = the sentence's words IN ORDER (the UI shuffles), `answer[0]` = the sentence
 * - match: `pairs` = English ↔ Vietnamese
 * - fix:   `prompt` = sentence with one mistake, `answer` = accepted corrected sentences
 */
export interface Exercise {
  type: ExerciseType;
  prompt: string;
  options: string[];
  answer: string[];
  pairs: { left: string; right: string }[];
  explanation: string;
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
