import { Injectable } from '@nestjs/common';
import type { SearchHit, SearchQuery, SearchResult } from '@pkb/contracts';
import { NoteService } from '../note';
import { ProjectService } from '../project';
import { TaskService } from '../task';

/**
 * Keyword search v1 (MySQL FULLTEXT). Owns no table: it asks each module's public API
 * and merges — the same seam a semantic search (Phase 3) will plug into.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly notes: NoteService,
    private readonly tasks: TaskService,
    private readonly projects: ProjectService,
  ) {}

  async search(q: SearchQuery): Promise<SearchResult> {
    const [noteHits, taskHits] = await Promise.all([
      this.notes.search(q.q, q.projectId, q.tag, q.limit),
      // Tasks have no tags: a tag filter means "notes only".
      q.tag ? Promise.resolve([]) : this.tasks.search(q.q, q.projectId, q.limit),
    ]);
    const projectIds = [...noteHits.map((h) => h.projectId), ...taskHits.map((h) => h.projectId)].filter((x): x is string => !!x);
    const projects = await this.projects.byIds(projectIds);
    const norm = (s: number, max: number) => (max > 0 ? s / max : 0);
    const maxN = Math.max(0, ...noteHits.map((h) => h.score));
    const maxT = Math.max(0, ...taskHits.map((h) => h.score));
    const hits: SearchHit[] = [
      ...noteHits.map((h) => ({
        kind: 'note' as const,
        id: h.id,
        title: h.title,
        snippet: h.snippet,
        projectId: h.projectId,
        projectName: h.projectId ? projects.get(h.projectId)?.name ?? null : null,
        status: null,
        matchedFiles: h.matchedFiles,
        score: norm(h.score, maxN),
        updatedAt: h.updatedAt.toISOString(),
      })),
      ...taskHits.map((h) => ({
        kind: 'task' as const,
        id: h.id,
        title: h.title,
        snippet: h.snippet,
        projectId: h.projectId,
        projectName: projects.get(h.projectId)?.name ?? null,
        status: h.status,
        matchedFiles: [],
        score: norm(h.score, maxT) * 0.9,
        updatedAt: h.updatedAt.toISOString(),
      })),
    ];
    hits.sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt));
    return { hits: hits.slice(0, q.limit) };
  }
}
