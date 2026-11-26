import { z } from 'zod';
import { CursorQuery, DateKey, Priority } from './common';

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export const TaskStatus = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const ChecklistItem = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  done: z.boolean(),
  position: z.string(),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const Task = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatus,
  priority: Priority,
  dueDate: z.string().nullable(),
  pinnedFor: z.string().nullable(),
  position: z.string(),
  recurrenceId: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof Task>;

/** List row: task + cheap aggregates for cards. */
export const TaskSummary = Task.extend({
  projectName: z.string(),
  projectColor: z.string().nullable(),
  checklistDone: z.number(),
  checklistTotal: z.number(),
});
export type TaskSummary = z.infer<typeof TaskSummary>;

export const TaskDetail = TaskSummary.extend({
  checklist: z.array(ChecklistItem),
  /** Present when the task is an instance of a recurring series. */
  recurrence: z
    .object({ id: z.string(), describe: z.string(), status: z.string() })
    .nullable(),
});
export type TaskDetail = z.infer<typeof TaskDetail>;

export const TaskListQuery = CursorQuery.extend({
  projectId: z.string().uuid().optional(),
  status: TaskStatus.optional(),
  /** default: hide done tasks completed more than 14 days ago */
  includeOldDone: z.coerce.boolean().optional(),
});
export type TaskListQuery = z.infer<typeof TaskListQuery>;

export const CreateTaskInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(100000).nullable().optional(),
  status: TaskStatus.default('todo'),
  priority: Priority.default(1),
  dueDate: DateKey.nullable().optional(),
  pinnedForToday: z.boolean().optional(),
  checklist: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(100000).nullable().optional(),
  priority: Priority.optional(),
  dueDate: DateKey.nullable().optional(),
  /** true = pin for today (server's today), false = unpin */
  pinnedForToday: z.boolean().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

/** Kanban drop: new column + neighbours in that column (ids, null = edge). */
export const MoveTaskInput = z.object({
  status: TaskStatus,
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
});
export type MoveTaskInput = z.infer<typeof MoveTaskInput>;

export const CompleteTaskResult = z.object({
  task: Task,
  /** The next open instance when a recurring instance was completed. */
  next: Task.nullable(),
});
export type CompleteTaskResult = z.infer<typeof CompleteTaskResult>;

export const CreateChecklistItemInput = z.object({ title: z.string().trim().min(1).max(500) });
export const UpdateChecklistItemInput = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  done: z.boolean().optional(),
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
});
export type UpdateChecklistItemInput = z.infer<typeof UpdateChecklistItemInput>;

export const Today = z.object({
  date: z.string(),
  overdue: z.array(TaskSummary),
  dueToday: z.array(TaskSummary),
  inProgress: z.array(TaskSummary),
  pinned: z.array(TaskSummary),
});
export type Today = z.infer<typeof Today>;
