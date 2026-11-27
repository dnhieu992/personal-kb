import type { Profile, UpdateProfileInput } from '@pkb/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/http';

export const profileApi = {
  get: () => http.get<Profile>('/profile'),
  update: (input: UpdateProfileInput) => http.put<Profile>('/profile', input),
};

export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: profileApi.get, staleTime: 5 * 60_000 });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: profileApi.update, onSuccess: (p) => qc.setQueryData(['profile'], p) });
}
