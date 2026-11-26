import type {
  ChecklistItem,
  CompleteTaskResult,
  CreateRecurrenceInput,
  CreateTaskInput,
  MoveTaskInput,
  Page,
  Recurrence,
  Task,
  TaskDetail,
  TaskStatus,
  TaskSummary,
  Today,
  UpdateChecklistItemInput,
  UpdateRecurrenceInput,
  UpdateTaskInput,
} from '@pkb/contracts';
import { http } from '@/shared/http';

export const tasksApi = {
  list: (q: { projectId?: string; status?: TaskStatus; includeOldDone?: boolean; cursor?: string; limit?: number }) =>
    http.get<Page<TaskSummary>>('/tasks', q),
  /** Follows cursors — a project board needs every open task. */
  async listAll(q: { projectId?: string; includeOldDone?: boolean }): Promise<TaskSummary[]> {
    const out: TaskSummary[] = [];
    let cursor: string | undefined;
    do {
      const page = await tasksApi.list({ ...q, limit: 200, cursor });
      out.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return out;
  },
  get: (id: string) => http.get<TaskDetail>(`/tasks/${id}`),
  create: (input: CreateTaskInput) => http.post<TaskDetail>('/tasks', input),
  update: (id: string, input: UpdateTaskInput) => http.patch<TaskDetail>(`/tasks/${id}`, input),
  move: (id: string, input: MoveTaskInput) => http.post<CompleteTaskResult>(`/tasks/${id}/move`, input),
  setStatus: (id: string, status: TaskStatus) => http.post<CompleteTaskResult>(`/tasks/${id}/status`, { status }),
  remove: (id: string) => http.del<{ next: Task | null }>(`/tasks/${id}`),
  today: () => http.get<Today>('/today'),
  addChecklist: (taskId: string, title: string) => http.post<ChecklistItem>(`/tasks/${taskId}/checklist`, { title }),
  updateChecklist: (id: string, input: UpdateChecklistItemInput) => http.patch<ChecklistItem>(`/checklist/${id}`, input),
  removeChecklist: (id: string) => http.del(`/checklist/${id}`),
  recurrences: (projectId?: string) => http.get<Recurrence[]>('/recurrences', { projectId }),
  createRecurrence: (input: CreateRecurrenceInput) => http.post<Recurrence>('/recurrences', input),
  updateRecurrence: (id: string, input: UpdateRecurrenceInput) => http.patch<Recurrence>(`/recurrences/${id}`, input),
};
