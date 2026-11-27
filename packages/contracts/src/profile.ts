import { z } from 'zod';

/** The single user's profile (shown in the sidebar avatar menu). */
export const Profile = z.object({
  displayName: z.string(),
  email: z.string().nullable(),
  bio: z.string().nullable(),
  /** Storage key of the avatar image (uploaded via /api/uploads/images), or null. */
  avatarKey: z.string().nullable(),
  /** Ready-to-use URL for the avatar, or null. */
  avatarUrl: z.string().nullable(),
});
export type Profile = z.infer<typeof Profile>;

export const UpdateProfileInput = z.object({
  displayName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200).nullable().or(z.literal('').transform(() => null)),
  bio: z.string().trim().max(500).nullable(),
  avatarKey: z.string().startsWith('images/').max(500).nullable(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;
