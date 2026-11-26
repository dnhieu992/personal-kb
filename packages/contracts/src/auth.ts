import { z } from 'zod';

export const LoginInput = z.object({ password: z.string().min(1).max(500) });
export type LoginInput = z.infer<typeof LoginInput>;

export const Me = z.object({ authenticated: z.literal(true), expiresAt: z.string() });
export type Me = z.infer<typeof Me>;

export const SESSION_COOKIE = 'pkb_session';
