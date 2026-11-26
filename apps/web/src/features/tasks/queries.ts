'use client';

import type { MoveTaskInput, TaskStatus, TaskSummary, UpdateChecklistItemInput, UpdateTaskInput, CreateTaskInput, CreateRecurrenceInput, UpdateRecurrenceInput, TaskDetail } from '@pkb/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '../projects/api';
import { toast } from '@/shared/ui/toast';
import { tasksApi } from './api';

export const taskKeys = {
  all: ['tasks'] as const,
  board: (projectId: string, includeOldDone = false) => ['tasks', 'board', projectId, includeOldDone] as const,
  one: (id: string) => ['tasks', 'one', id] as const,
  today: () => ['tasks', 'today'] as const,
  recurrences: (projectId?: string) => ['tasks', 'recurrences', projectId ?? 'all'] as const,
};

export const useBoard = (projectId: string, includeOldDone = false) =>
  useQuery({ queryKey: taskKeys.board(projectId, includeOldDone), queryFn: () => tasksApi.listAll({ projectId, includeOldDone }) });
export const useTask = (id: string | null) => useQuery({ queryKey: taskKeys.one(id ?? ''), queryFn: () => tasksApi.get(id!), enabled: !!id });
export const useToday = () => useQuery({ queryKey: taskKeys.today(), queryFn: tasksApi.today });
export const useRecurrences = (projectId?: string) =>
  useQuery({ queryKey: taskKeys.recurrences(projectId), queryFn: () => tasksApi.recurrences(projectId) });

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: taskKeys.all });
    qc.invalidateQueries({ queryKey: projectKeys.cards() });
  };
}

function nextToast(r: { next: { dueDate: string | null } | null }) {
  if (r.next) toast(`Next occurrence created${r.next.dueDate ? ` · due ${r.next.dueDate}` : ''}`);
}

export function useCreateTask() {
  const done = useInvalidateTasks();
  return useMutation({ mutationFn: (i: CreateTaskInput) => tasksApi.create(i), onSuccess: done });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  const done = useInvalidateTasks();
  return useMutation({
    mutationFn: (i: UpdateTaskInput) => tasksApi.update(id, i),
    onSuccess: (t) => {
      qc.setQueryData(taskKeys.one(id), t);
      done();
    },
  });
}

export function useSetStatus() {
  const done = useInvalidateTasks();
  return useMutation({
    mutationFn: (v: { id: string; status: TaskStatus }) => tasksApi.setStatus(v.id, v.status),
    onSuccess: (r) => {
      nextToast(r);
      done();
    },
  });
}

/** Kanban drop with an optimistic update; rolls back if the server refuses. */
export function useMoveTask(projectId: string, includeOldDone: boolean) {
  const qc = useQueryClient();
  const done = useInvalidateTasks();
  const key = taskKeys.board(projectId, includeOldDone);
  return useMutation({
    mutationFn: (v: { id: string; input: MoveTaskInput; optimisticPosition: string }) => tasksApi.move(v.id, v.input),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskSummary[]>(key);
      qc.setQueryData<TaskSummary[]>(key, (xs) =>
        xs?.map((t) => (t.id === v.id ? { ...t, status: v.input.status, position: v.optimisticPosition } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSuccess: nextToast,
    onSettled: done,
  });
}

export function useDeleteTask() {
  const done = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: (r) => {
      if (r.next) toast(`Skipped — next occurrence due ${r.next.dueDate}`);
      done();
    },
  });
}

/** Checklist ticks are optimistic on the task detail cache. */
export function useChecklist(taskId: string) {
  const qc = useQueryClient();
  const key = taskKeys.one(taskId);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
    qc.invalidateQueries({ queryKey: taskKeys.today() });
  };
  const add = useMutation({ mutationFn: (title: string) => tasksApi.addChecklist(taskId, title), onSuccess: refresh });
  const update = useMutation({
    mutationFn: (v: { id: string; input: UpdateChecklistItemInput }) => tasksApi.updateChecklist(v.id, v.input),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskDetail>(key);
      qc.setQueryData<TaskDetail>(key, (t) =>
        t && { ...t, checklist: t.checklist.map((c) => (c.id === v.id ? { ...c, ...('done' in v.input ? { done: !!v.input.done } : {}), ...(v.input.title ? { title: v.input.title } : {}) } : c)) },
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => tasksApi.removeChecklist(id), onSuccess: refresh });
  return { add, update, remove };
}

export function useCreateRecurrence() {
  const done = useInvalidateTasks();
  return useMutation({ mutationFn: (i: CreateRecurrenceInput) => tasksApi.createRecurrence(i), onSuccess: done });
}

export function useUpdateRecurrence() {
  const done = useInvalidateTasks();
  return useMutation({ mutationFn: (v: { id: string; input: UpdateRecurrenceInput }) => tasksApi.updateRecurrence(v.id, v.input), onSuccess: done });
}
