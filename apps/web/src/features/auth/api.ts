import type { LoginInput, Me } from '@pkb/contracts';
import { http } from '@/shared/http';

export const authApi = {
  login: (input: LoginInput) => http.post<Me>('/auth/login', input),
  logout: () => http.post<void>('/auth/logout'),
};
