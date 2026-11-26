/**
 * A note hangs off a task, OR a project, OR nothing — never both. The DB has the same
 * rule as a CHECK constraint; this gives a friendly 400 before we get there.
 */
export function resolveParent(
  current: { projectId: string | null; taskId: string | null },
  patch: { projectId?: string | null; taskId?: string | null },
): { projectId: string | null; taskId: string | null } {
  const hasP = patch.projectId !== undefined;
  const hasT = patch.taskId !== undefined;
  if (hasP && hasT && patch.projectId && patch.taskId) {
    throw new NoteRuleError('A note belongs to a task OR a project, not both.');
  }
  // Setting one side clears the other (re-filing a note), so callers can send just one.
  if (hasT && patch.taskId) return { projectId: null, taskId: patch.taskId };
  if (hasP && patch.projectId) return { projectId: patch.projectId, taskId: null };
  return {
    projectId: hasP ? null : current.projectId,
    taskId: hasT ? null : current.taskId,
  };
}

/** Lowercased, trimmed, de-duplicated, order kept. */
export function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const v = t.trim().toLowerCase().replace(/\s+/g, ' ');
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export function excerpt(markdown: string, size = 180): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > size ? plain.slice(0, size).trimEnd() + '…' : plain;
}

export class NoteRuleError extends Error {}
