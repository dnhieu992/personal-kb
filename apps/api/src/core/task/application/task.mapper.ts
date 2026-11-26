import type { ChecklistItem, Project, Recurrence, Task, TaskSummary } from '@pkb/contracts';
import { iso } from '../../../platform/database/cursor';
import { ChecklistItemEntity } from '../infra/checklist-item.entity';
import { RecurrenceEntity } from '../infra/recurrence.entity';
import { TaskEntity } from '../infra/task.entity';

export function toTask(e: TaskEntity): Task {
  return {
    id: e.id,
    projectId: e.projectId,
    title: e.title,
    description: e.description,
    status: e.status,
    priority: e.priority,
    dueDate: e.dueDate,
    pinnedFor: e.pinnedFor,
    position: e.position,
    recurrenceId: e.recurrenceId,
    completedAt: iso(e.completedAt),
    createdAt: iso(e.createdAt)!,
    updatedAt: iso(e.updatedAt)!,
  };
}

export function toSummary(
  e: TaskEntity,
  project: Project | undefined,
  counts: { done: number; total: number } | undefined,
): TaskSummary {
  return {
    ...toTask(e),
    projectName: project?.name ?? '?',
    projectColor: project?.color ?? null,
    checklistDone: counts?.done ?? 0,
    checklistTotal: counts?.total ?? 0,
  };
}

export function toChecklistItem(e: ChecklistItemEntity): ChecklistItem {
  return { id: e.id, taskId: e.taskId, title: e.title, done: !!e.done, position: e.position };
}

export function toRecurrence(e: RecurrenceEntity): Recurrence {
  return {
    id: e.id,
    projectId: e.projectId,
    title: e.title,
    description: e.description,
    priority: e.priority,
    rule: e.rule,
    anchorDate: e.anchorDate,
    status: e.status,
    checklistTemplate: e.checklistTemplate ?? [],
    createdAt: iso(e.createdAt)!,
    updatedAt: iso(e.updatedAt)!,
  };
}
