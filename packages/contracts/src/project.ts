import { z } from 'zod';

export const Project = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof Project>;

export const ProjectWithCounts = Project.extend({
  openTasks: z.number(),
  doneTasks: z.number(),
  notes: z.number(),
});
export type ProjectWithCounts = z.infer<typeof ProjectWithCounts>;

const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB');

export const CreateProjectInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(20000).nullable().optional(),
  color: Color.nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = CreateProjectInput.partial().extend({
  archived: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;
