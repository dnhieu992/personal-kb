import { z } from 'zod';
import { DateKey, Priority } from './common';

export const RecurrenceRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily') }),
  /** weekdays: 0 = Sunday … 6 = Saturday, e.g. [1,3,5] = Mon/Wed/Fri */
  z.object({
    kind: z.literal('weekly'),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }),
  /** Fixed day of month; clamped to the month's last day (31 → Feb 28). */
  z.object({ kind: z.literal('monthly'), day: z.number().int().min(1).max(31) }),
  z.object({ kind: z.literal('everyNDays'), interval: z.number().int().min(1).max(365) }),
]);
export type RecurrenceRule = z.infer<typeof RecurrenceRule>;

export const RECURRENCE_STATUSES = ['active', 'paused', 'ended'] as const;
export const RecurrenceStatus = z.enum(RECURRENCE_STATUSES);
export type RecurrenceStatus = z.infer<typeof RecurrenceStatus>;

export const Recurrence = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  priority: Priority,
  rule: RecurrenceRule,
  anchorDate: z.string(),
  status: RecurrenceStatus,
  checklistTemplate: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Recurrence = z.infer<typeof Recurrence>;

/** Creates the series AND its first open instance. */
export const CreateRecurrenceInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(100000).nullable().optional(),
  priority: Priority.default(1),
  rule: RecurrenceRule,
  /** First due date is the first day on/after this that matches the rule. */
  anchorDate: DateKey,
  checklistTemplate: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
});
export type CreateRecurrenceInput = z.infer<typeof CreateRecurrenceInput>;

/** Changes apply to future instances; pause/end stop generating new ones. */
export const UpdateRecurrenceInput = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(100000).nullable().optional(),
  priority: Priority.optional(),
  rule: RecurrenceRule.optional(),
  status: RecurrenceStatus.optional(),
  checklistTemplate: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
});
export type UpdateRecurrenceInput = z.infer<typeof UpdateRecurrenceInput>;

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function describeRule(rule: RecurrenceRule): string {
  switch (rule.kind) {
    case 'daily':
      return 'Every day';
    case 'weekly':
      return 'Every ' + [...rule.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WD[d]).join(', ');
    case 'monthly':
      return `Monthly on day ${rule.day}`;
    case 'everyNDays':
      return rule.interval === 1 ? 'Every day' : `Every ${rule.interval} days`;
  }
}
