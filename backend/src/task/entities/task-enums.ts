/**
 * Shared by both task entities. They reference each other, so enums that are
 * read at decoration time must live outside that cycle — a `@Column({ enum })`
 * on the module's own import loop resolves to `undefined` at runtime.
 */

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/** Which part of life a task belongs to. */
export enum TaskCategory {
  COMPANY = 'COMPANY',
  PERSONAL = 'PERSONAL',
}

/**
 * How far the English coaching pass has got. Tasks are saved immediately and
 * coached in the background, so the UI needs to know whether the wording it is
 * showing is still the raw text the author typed.
 */
export enum CoachStatus {
  /** Queued or running: title/notes may still be rewritten. */
  PENDING = 'PENDING',
  /** Finished: title/notes are the corrected English. */
  DONE = 'DONE',
  /** Never asked for — `autoCoach: false`, or the AI is not configured. */
  SKIPPED = 'SKIPPED',
  /** The AI call failed; the text was left exactly as typed. */
  FAILED = 'FAILED',
}
