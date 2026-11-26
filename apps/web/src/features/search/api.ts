import type { AskResult, SearchResult, SemanticResult } from '@pkb/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { http } from '@/shared/http';

export const searchApi = {
  search: (q: { q: string; projectId?: string; tag?: string }) => http.get<SearchResult>('/search', q),
  semantic: (q: string) => http.get<SemanticResult>('/search/semantic', { q }),
  ask: (question: string) => http.post<AskResult>('/ask', { question }),
};

export const useSearch = (q: { q: string; projectId?: string; tag?: string }) =>
  useQuery({ queryKey: ['search', q], queryFn: () => searchApi.search(q), enabled: q.q.trim().length > 0 });

export const useSemantic = (q: string, enabled: boolean) =>
  useQuery({ queryKey: ['search', 'semantic', q], queryFn: () => searchApi.semantic(q), enabled: enabled && q.trim().length > 0 });

export const useAsk = () => useMutation({ mutationFn: (question: string) => searchApi.ask(question) });
