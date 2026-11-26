/**
 * English module client (isolated: talks only to /api/english/* and /api/uploads/images).
 * Types are the v1 shapes the ported pages were written against; the server keeps them.
 */
import { uploadImages, type ImageRef } from '@/shared/upload-images';

const API = '/api';

class EnglishApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function requestOnce<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    credentials: 'same-origin',
    ...init,
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const p = await res.json();
      detail = p.detail || p.title || detail;
    } catch {}
    throw new EnglishApiError(res.status, detail);
  }
  const body = await res.text();
  return (body ? JSON.parse(body) : null) as T;
}

// GETs get one retry on network/5xx errors; writes never do.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') return requestOnce<T>(path, init);
  try {
    return await requestOnce<T>(path, init);
  } catch (e) {
    if (e instanceof EnglishApiError && e.status < 500) throw e;
    await new Promise((r) => setTimeout(r, 300));
    return requestOnce<T>(path, init);
  }
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });


export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type EnglishKind =
  | 'JOURNAL'
  | 'SENTENCE'
  | 'GRAMMAR'
  | 'MISTAKE'
  | 'VOCAB';

export const REVIEWABLE_KINDS: EnglishKind[] = [
  'SENTENCE',
  'GRAMMAR',
  'MISTAKE',
  'VOCAB',
];

export const KIND_LABELS: Record<EnglishKind, string> = {
  JOURNAL: 'Nhật ký',
  SENTENCE: 'Câu',
  GRAMMAR: 'Ngữ pháp',
  MISTAKE: 'Lỗi',
  VOCAB: 'Từ vựng',
};

export const KIND_COLORS: Record<EnglishKind, string> = {
  JOURNAL: 'tone-gray',
  SENTENCE: 'tone-sky',
  GRAMMAR: 'tone-violet',
  MISTAKE: 'tone-red',
  VOCAB: 'tone-amber',
};

export type { ImageRef } from '@/shared/upload-images';

export interface Knowledge {
  id: string;
  title: string;
  /** Formatted, English body. */
  content: string;
  /** What the author typed, when the AI translated/rewrote it. */
  originalContent?: string | null;
  /** Where a collected card was met (text) and an in-app link back. */
  source?: string | null;
  sourceUrl?: string | null;
  tags: string[];
  images: ImageRef[] | null;
  type: 'ENGLISH';
  codeSnippets?: string[];
  summary: string;
  projectId: string | null;
  englishKind: EnglishKind | null;
  sourceId: string | null;
  hard: boolean;
  cefrLevel: CefrLevel | null;
  reviewCount: number;
  correctCount: number;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

export interface JournalWithItems {
  journal: Knowledge;
  items: Knowledge[];
}

/** Where a batch of collected review cards came from. */
export interface CollectedSource {
  id: string;
  title: string;
  kind: 'NOTE' | 'TASK' | 'OTHER';
  href: string | null;
  createdAt: string;
}

/** English cards collected while saving an entry or a task, with their source. */
export interface CollectedFromSource {
  source: CollectedSource;
  items: Knowledge[];
}

export interface EnglishStats {
  journalCount: number;
  itemCount: number;
  byLevel: Record<CefrLevel, number>;
  byKind: Record<string, number>;
  reviewAccuracy: number;
  dueForReview: number;
  weekly: { date: string; count: number }[];
}


export interface Phrase {
  id: string;
  phrase: string;
  meaning: string;
  example: string | null;
  /** false = no longer sent by the daily Telegram cron. */
  active: boolean;
  /** How many times it has been sent to Telegram. */
  sentCount: number;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhraseInput {
  phrase: string;
  meaning: string;
  example?: string | null;
  active?: boolean;
}

const C = '/english/course';

export const api = {
  /** URL of English speech (audio/wav) for `text` — played by speech.ts. */
  ttsUrl: (text: string, rate = 1) => `${API}/english/tts?rate=${rate}&text=${encodeURIComponent(text.trim())}`,

  uploadImages,

  english: {
    createJournal: (text: string, images?: ImageRef[]) =>
      request<JournalWithItems>('/english/journal', json('POST', { text, images: images ?? [] })),
    journal: () => request<JournalWithItems[]>('/english/journal'),
    collected: (limit?: number) => request<CollectedFromSource[]>(`/english/collected${limit ? `?limit=${limit}` : ''}`),
    review: (limit?: number) => request<Knowledge[]>(`/english/review${limit ? `?limit=${limit}` : ''}`),
    stats: () => request<EnglishStats>('/english/stats'),
    recordReview: (id: string, remembered: boolean) =>
      request<Knowledge>(`/english/cards/${id}/review`, json('POST', { remembered })),
    removeCard: (id: string) => request<{ deleted: boolean }>(`/english/cards/${id}`, { method: 'DELETE' }),
    /** Proofread any text; nothing is saved. */
    check: (text: string) => request<EnglishCheck>('/english/check', json('POST', { text })),
    /** Accepted fixes + chosen cards → review queue. */
    recordMistakes: (body: { changes: EnglishChange[]; cards: EnglishCard[]; source?: string; sourceUrl?: string }) =>
      request<{ saved: number; skipped: number }>('/english/mistakes', json('POST', body)),
  },

  course: {
    overview: (level?: CourseLevel) => request<CourseOverview>(`${C}/overview${level ? `?level=${level}` : ''}`),
    lesson: (id: string) => request<LessonDetail>(`${C}/lessons/${id}`),
    submitAttempt: (id: string, body: { correct: number; total: number; answers: unknown[]; quick?: boolean }) =>
      request<AttemptResult>(`${C}/lessons/${id}/attempts`, json('POST', body)),
    generate: (level: CourseLevel) => request<{ started: boolean; enabled: boolean }>(`${C}/levels/${level}/generate`, { method: 'POST' }),
    grade: (id: string, index: number, text: string) => request<WritingGrade>(`${C}/lessons/${id}/grade`, json('POST', { index, text })),
    regenerate: (id: string) => request<CourseLesson>(`${C}/lessons/${id}/regenerate`, { method: 'POST' }),
    listening: (id: string) => request<ListeningInfo>(`${C}/lessons/${id}/listening`),
    generateListening: (id: string) => request<ListeningInfo>(`${C}/lessons/${id}/listening/generate`, { method: 'POST' }),
    gradeListening: (id: string, text: string, questionsCorrect?: number) =>
      request<SummaryGrade>(`${C}/lessons/${id}/listening/grade`, json('POST', { text, questionsCorrect })),
    journey: () => request<Journey>(`${C}/journey`),
    weak: () => request<WeakOverview>(`${C}/review/weak`),
    dailyReview: () => request<{ items: ReviewItem[]; due: number }>(`${C}/review/daily`),
    reviewFocus: (key: string) => request<ReviewFocus>(`${C}/review/points/${encodeURIComponent(key)}`),
    submitReview: (results: { lessonId: string; index: number; correct: boolean; answer?: Record<string, unknown> }[]) =>
      request<ReviewSubmitResult>(`${C}/review/results`, json('POST', { results })),
    setGoal: (goal: { targetLevel: CourseLevel; weeklyLessons: number; startLevel?: CourseLevel; weakFirst?: boolean }) =>
      request<Journey>(`${C}/goal`, json('PUT', goal)),
    placement: () => request<PlacementResult | null>(`${C}/placement`),
    placementTest: () => request<PlacementTest>(`${C}/placement/test`),
    checkBlock: (level: CourseLevel, answers: Record<string, string>) =>
      request<BlockResult>(`${C}/placement/blocks/${level}`, json('POST', { answers })),
    submitPlacement: (answers: Record<string, string>) => request<PlacementResult>(`${C}/placement`, json('POST', { answers })),
    placementReview: (id: string) => request<PlacementReviewItem[] | null>(`${C}/placement/${id}/review`),
    setEfset: (score: number) => request<PlacementResult>(`${C}/placement/efset`, json('POST', { score })),
  },

  phrases: {
    list: () => request<Phrase[]>('/english/phrases'),
    create: (body: PhraseInput) => request<Phrase>('/english/phrases', json('POST', body)),
    update: (id: string, body: PhraseInput) => request<Phrase>(`/english/phrases/${id}`, json('PUT', body)),
    /** Toggle whether the daily cron still sends this phrase. */
    setActive: (id: string, active: boolean) => request<Phrase>(`/english/phrases/${id}`, json('PUT', { active })),
    remove: (id: string) => request<{ deleted: boolean }>(`/english/phrases/${id}`, { method: 'DELETE' }),
    /** Send today's batch immediately (same as the daily cron). */
    sendNow: () => request<{ sent: number; phrases: Phrase[] }>('/english/phrases/send-now', { method: 'POST' }),
  },

};

export type CourseLevel = 'A2' | 'B1' | 'B2' | 'C1';
export const COURSE_LEVELS: CourseLevel[] = ['A2', 'B1', 'B2', 'C1'];

export type LessonStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
export type ExerciseType = 'mcq' | 'gap' | 'order' | 'match' | 'fix' | 'listen' | 'read' | 'write';

export interface Exercise {
  type: ExerciseType;
  prompt: string;
  options: string[];
  answer: string[];
  pairs: { left: string; right: string }[];
  explanation: string;
  /** listen: what is read aloud (hidden until checked); read: the text. */
  passage?: string;
}

export interface ListeningQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface ListeningIdea {
  idea: string;
  vi: string;
}

/** A lesson's listening task: passage read aloud, questions, summary graded on key ideas. */
export interface ListeningTask {
  id: string;
  lessonId: string;
  level: CourseLevel;
  status: 'GENERATING' | 'READY' | 'FAILED';
  error: string | null;
  targetWords: number;
  title: string | null;
  context: string | null;
  passage: string | null;
  translation: string | null;
  wordCount: number;
  questions: ListeningQuestion[] | null;
  ideas: ListeningIdea[] | null;
  bestScore: number | null;
  passedAt: string | null;
  attemptCount: number;
  lastSummary: string | null;
  lastGrade: SummaryGrade | null;
}

export interface ListeningInfo {
  /** null = not written yet. */
  task: ListeningTask | null;
  targetWords: number;
  passScore: number;
  minSummaryWords: number;
  enabled: boolean;
}

export interface SummaryGrade {
  score: number;
  passed: boolean;
  ideas: (ListeningIdea & { index: number; status: 'covered' | 'partial' | 'missing'; note: string })[];
  feedback: string;
  corrected: string;
  ai: boolean;
  bestScore?: number;
}

export interface WritingGrade {
  score: number;
  correct: boolean;
  feedback: string;
  corrected: string;
  /** false = AI unavailable, only an exact model-answer match counts. */
  ai: boolean;
}

export interface VocabItem {
  word: string;
  ipa: string;
  pos: string;
  meaning: string;
  example: string;
}

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
  completedAt: string | null;
  bestScore: number | null;
  attemptCount: number;
  syllabusKeys: string[] | null;
  /** REVIEW = the unit's closing mixed test (no theory/vocab). */
  kind: LessonKind;
  /** From the latest placement test: mastered points can be skipped, weak ones come first. */
  mastery: Mastery;
  locked: boolean;
}

export type Mastery = 'mastered' | 'weak' | null;
export type LessonKind = 'LESSON' | 'REVIEW';

/** The way from the start level to the end of the goal level. */
export interface Journey {
  start: CourseLevel;
  target: CourseLevel;
  goalSet: boolean;
  weeklyLessons: number;
  /** Recommend weak-point lessons before the path order. */
  weakFirst: boolean;
  /** `estimated`: not fully written yet, `total` is the planned size. */
  levels: { level: CourseLevel; done: number; total: number; estimated: boolean; minutesLeft: number }[];
  done: number;
  total: number;
  pct: number;
  minutesLeft: number;
  /** Lessons passed in the last 7 days. */
  last7: number;
  /** Lessons per week, last 4 weeks. */
  pace: number;
  streak: number;
  studiedToday: boolean;
  etaAtGoal: string | null;
  etaAtPace: string | null;
  next: {
    id: string;
    title: string;
    level: CourseLevel;
    status: LessonStatus;
    locked: boolean;
    mastery: Mastery;
    kind: LessonKind;
  } | null;
}

export interface SyllabusPoint {
  key: string;
  level: CourseLevel;
  kind: 'grammar' | 'discourse';
  name: string;
  vi: string;
}

export interface CourseFramework {
  gse: string;
  efset: string;
  canDo: string[];
  functions: string[];
  points: (SyllabusPoint & { lessonIds: string[]; done: boolean })[];
  extra: SyllabusPoint[];
  sources: { name: string; use: string; url: string }[];
}

export type PlacementSkill = 'grammar' | 'vocab' | 'reading' | 'listening';

export interface PlacementItem {
  id: string;
  level: CourseLevel;
  skill: PlacementSkill;
  key: string | null;
  prompt: string;
  options: string[];
  passage?: string;
  audio?: string;
}

export interface PlacementTest {
  levels: CourseLevel[];
  passShare: number;
  stopShare: number;
  items: PlacementItem[];
}

export interface BlockResult {
  level: CourseLevel;
  correct: number;
  total: number;
  passed: boolean;
  next: boolean;
}

export interface PlacementResult {
  id: string;
  placedLevel: CourseLevel;
  score: number;
  levels: { level: CourseLevel; correct: number; total: number; taken: boolean }[];
  skills: { skill: PlacementSkill; correct: number; total: number }[];
  mastered: string[];
  weak: string[];
  efsetScore: number | null;
  efsetLevel: string | null;
  inAppTaken: boolean;
  masteredPoints: SyllabusPoint[];
  weakPoints: SyllabusPoint[];
  createdAt: string;
}

export interface PlacementReviewItem extends PlacementItem {
  answer: string;
  chosen: string;
  correct: boolean;
}

export interface CourseLesson extends Omit<LessonSummary, 'locked' | 'mastery'> {
  level: CourseLevel;
  error: string | null;
  intro: string | null;
  theory: string | null;
  phrases: { en: string; vi: string }[] | null;
  vocab: VocabItem[] | null;
  exercises: Exercise[] | null;
}

export interface CourseUnit {
  id: string;
  level: CourseLevel;
  position: number;
  title: string;
  titleVi: string;
  summary: string;
}

export interface LevelStatus {
  level: CourseLevel;
  units: number;
  total: number;
  ready: number;
  failed: number;
  /** Older lessons still without listening/reading/writing practice. */
  needSkills: number;
  done: number;
  generating: boolean;
  error: string | null;
}

export interface CourseOverview {
  level: CourseLevel;
  levels: LevelStatus[];
  units: (CourseUnit & { lessons: LessonSummary[] })[];
  next: LessonSummary | null;
  progress: { done: number; total: number };
  averageScore: number | null;
  vocabLearned: number;
  passScore: number;
  quickPassScore: number;
  reviewPassScore: number;
  /** Planned size of a level. */
  plan: { units: number; lessonsPerUnit: number };
  journey: Journey;
  placement: PlacementResult | null;
  /** Weak-point lessons not yet passed. */
  focus: LessonSummary[];
  framework: CourseFramework | null;
}

export interface LessonDetail {
  lesson: CourseLesson;
  unit: CourseUnit | null;
  locked: boolean;
  /** For a locked lesson: the earlier lesson to pass first. */
  blockedBy: { id: string; title: string; unit: number | null; position: number } | null;
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
  passScore: number;
  quickPassScore: number;
  mastery: Mastery;
  points: SyllabusPoint[];
  journey: Journey;
}

export interface AttemptResult {
  score: number;
  passed: boolean;
  firstPass: boolean;
  bestScore: number;
  passScore: number;
  cardsAdded: number;
  nextId: string | null;
  journey: Journey;
}

// --- Review built on mistakes ---

export interface WeakPoint {
  key: string;
  name: string;
  vi: string;
  level: string | null;
  seen: number;
  wrong: number;
  /** % right, null before any answer. */
  accuracy: number | null;
  /** Missed exercises due now. */
  due: number;
  /** Missed exercises not resolved yet (3 right in a row resolves one). */
  open: number;
  /** Flagged by the placement test. */
  placement: boolean;
  lessons: { id: string; title: string }[];
}

export interface WeakOverview {
  points: WeakPoint[];
  due: number;
  open: number;
  resolved: number;
}

export interface ReviewItem {
  lessonId: string;
  index: number;
  lessonTitle: string;
  point: { key: string; name: string; vi: string } | null;
  exercise: Exercise;
  missed: boolean;
}

export interface ReviewFocus {
  point: { key: string; name: string; vi: string; level: string | null };
  tips: { lessonId: string; lessonTitle: string; markdown: string }[];
  mistakes: {
    lessonId: string;
    lessonTitle: string;
    index: number;
    exercise: Exercise;
    answer: Record<string, unknown> | null;
    wrong: number;
    resolved: boolean;
  }[];
  test: ReviewItem[];
}

export interface ReviewSubmitResult {
  correct: number;
  total: number;
  points: WeakPoint[];
}

/** One proposed fix from "Check English". */
export interface EnglishChange {
  original: string;
  replacement: string;
  kind: 'grammar' | 'vocab' | 'vietnamese' | 'spelling' | 'style';
  note: string;
}

export interface EnglishCard {
  front: string;
  meaning: string;
  kind: 'VOCAB' | 'MISTAKE' | 'GRAMMAR';
  example: string;
}

export interface EnglishCheck {
  corrected: string;
  changes: EnglishChange[];
  cards: EnglishCard[];
}

