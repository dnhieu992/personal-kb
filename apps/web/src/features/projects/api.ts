import type { CreateProjectInput, Project, ProjectWithCounts, UpdateProjectInput } from '@pkb/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/http';

export const projectsApi = {
  list: () => http.get<Project[]>('/projects'),
  cards: () => http.get<ProjectWithCounts[]>('/overview/projects'),
  get: (id: string) => http.get<Project>(`/projects/${id}`),
  create: (input: CreateProjectInput) => http.post<Project>('/projects', input),
  update: (id: string, input: UpdateProjectInput) => http.patch<Project>(`/projects/${id}`, input),
  remove: (id: string) => http.del(`/projects/${id}`),
};

export const projectKeys = {
  all: ['projects'] as const,
  list: () => ['projects', 'list'] as const,
  cards: () => ['projects', 'cards'] as const,
  one: (id: string) => ['projects', 'one', id] as const,
};

export const useProjects = () => useQuery({ queryKey: projectKeys.list(), queryFn: projectsApi.list });
export const useProjectCards = () => useQuery({ queryKey: projectKeys.cards(), queryFn: projectsApi.cards });
export const useProject = (id: string) => useQuery({ queryKey: projectKeys.one(id), queryFn: () => projectsApi.get(id) });

export function useSaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id?: string; input: CreateProjectInput | UpdateProjectInput }) =>
      v.id ? projectsApi.update(v.id, v.input) : projectsApi.create(v.input as CreateProjectInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: projectsApi.remove, onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }) });
}
