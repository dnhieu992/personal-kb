import { z } from 'zod';

/**
 * English module contracts (isolated module: nothing here references tasks or notes).
 * Request schemas only — the response shapes of the ported English pages are typed in
 * apps/web/src/features/english/api.ts, as they were in v1.
 */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const CefrLevel = z.enum(CEFR_LEVELS);
export type CefrLevel = z.infer<typeof CefrLevel>;

/** Reviewable card kinds (a JOURNAL entry is not a card). */
export const CARD_KINDS = ['SENTENCE', 'GRAMMAR', 'MISTAKE', 'VOCAB'] as const;
export const CardKind = z.enum(CARD_KINDS);
export type CardKind = z.infer<typeof CardKind>;

// ---- course ----
export const SetGoalInput = z.object({
  startLevel: CefrLevel.optional(),
  targetLevel: CefrLevel,
  weeklyLessons: z.number().int().min(1).max(30),
  weakFirst: z.boolean().optional(),
});
export type SetGoalInput = z.infer<typeof SetGoalInput>;

export const SubmitPlacementInput = z.object({ answers: z.record(z.string()) });
export type SubmitPlacementInput = z.infer<typeof SubmitPlacementInput>;
export const EfsetScoreInput = z.object({ score: z.number().int().min(0).max(100) });
export type EfsetScoreInput = z.infer<typeof EfsetScoreInput>;

export const ReviewResultInput = z.object({
  lessonId: z.string().uuid(),
  index: z.number().int().min(0),
  correct: z.boolean(),
  answer: z.record(z.unknown()).optional(),
});
export const SubmitReviewInput = z.object({ results: z.array(ReviewResultInput).max(60) });
export type SubmitReviewInput = z.infer<typeof SubmitReviewInput>;

export const SubmitAttemptInput = z.object({
  correct: z.number().int().min(0),
  total: z.number().int().min(1),
  answers: z.array(z.unknown()).optional(),
  quick: z.boolean().optional(),
});
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptInput>;
export const GradeWritingInput = z.object({ index: z.number().int().min(0), text: z.string().trim().min(1).max(1000) });
export type GradeWritingInput = z.infer<typeof GradeWritingInput>;
export const GradeSummaryInput = z.object({
  text: z.string().trim().min(1).max(4000),
  questionsCorrect: z.number().int().min(0).optional(),
});
export type GradeSummaryInput = z.infer<typeof GradeSummaryInput>;

// ---- phrases ----
export const CreatePhraseInput = z.object({
  phrase: z.string().trim().min(1).max(255),
  meaning: z.string().min(1),
  example: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type CreatePhraseInput = z.infer<typeof CreatePhraseInput>;
export const UpdatePhraseInput = CreatePhraseInput.partial();
export type UpdatePhraseInput = z.infer<typeof UpdatePhraseInput>;

// ---- games ----
export const GameProgressInput = z.object({ data: z.record(z.unknown()) });
export type GameProgressInput = z.infer<typeof GameProgressInput>;

// ---- journal & cards ----
export const ImageRefSchema = z.object({
  key: z.string().max(500),
  url: z.string().max(1000),
  name: z.string().max(255).optional(),
  size: z.number().optional(),
  type: z.string().max(200).optional(),
});
export const CreateJournalInput = z.object({
  text: z.string().trim().min(1).max(100_000),
  images: z.array(ImageRefSchema).max(20).default([]),
});
export type CreateJournalInput = z.infer<typeof CreateJournalInput>;

export const UpdateCardInput = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  summary: z.string().max(5000).nullable().optional(),
  cefrLevel: CefrLevel.nullable().optional(),
  hard: z.boolean().optional(),
});
export type UpdateCardInput = z.infer<typeof UpdateCardInput>;

export const ReviewCardInput = z.object({ remembered: z.boolean() });
export const RequestImageUploadInput = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.string().max(200).regex(/^image\//, 'Images only'),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
});
export type RequestImageUploadInput = z.infer<typeof RequestImageUploadInput>;
export type ReviewCardInput = z.infer<typeof ReviewCardInput>;

// ---- Check English (core editors → English module, one-way over HTTP) ----
export const CHANGE_KINDS = ['grammar', 'vocab', 'vietnamese', 'spelling', 'style'] as const;
export const EnglishChange = z.object({
  original: z.string(),
  replacement: z.string(),
  kind: z.enum(CHANGE_KINDS),
  /** short Vietnamese explanation */
  note: z.string(),
});
export type EnglishChange = z.infer<typeof EnglishChange>;

export const CheckEnglishInput = z.object({ text: z.string().min(1).max(60_000) });
export type CheckEnglishInput = z.infer<typeof CheckEnglishInput>;
export const CheckEnglishResult = z.object({
  corrected: z.string(),
  changes: z.array(EnglishChange),
  cards: z.array(z.object({ front: z.string(), meaning: z.string(), kind: z.enum(['VOCAB', 'MISTAKE', 'GRAMMAR']), example: z.string() })),
});
export type CheckEnglishResult = z.infer<typeof CheckEnglishResult>;

/**
 * Accepted fixes become review cards. `source` is free text/URL (e.g. "note: Kafka notes",
 * "/notes/<id>") — the English module never holds a foreign key into core tables.
 */
export const RecordMistakesInput = z.object({
  changes: z.array(EnglishChange.pick({ original: true, replacement: true, kind: true, note: true })).max(50).default([]),
  cards: CheckEnglishResult.shape.cards.max(30).default([]),
  /** where it was met, e.g. "Note: Kafka rebalance notes" */
  source: z.string().max(300).optional(),
  /** in-app link back, e.g. "/notes/<id>" or "/projects/<id>?task=<id>" */
  sourceUrl: z.string().max(500).optional(),
});
export type RecordMistakesInput = z.infer<typeof RecordMistakesInput>;
export const RecordMistakesResult = z.object({ saved: z.number(), skipped: z.number() });
export type RecordMistakesResult = z.infer<typeof RecordMistakesResult>;

// ---- diary ----
export const DiaryEntryInput = z.object({ content: z.string().trim().min(1).max(100_000) });
export type DiaryEntryInput = z.infer<typeof DiaryEntryInput>;
