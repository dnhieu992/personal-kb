import { Controller, Get } from '@nestjs/common';
import type { ProjectWithCounts } from '@pkb/contracts';
import { NoteService } from '../note';
import { ProjectService } from '../project';
import { TaskService } from '../task';

/**
 * Read-only composition across modules (project ← task ← note). The project module
 * can't count tasks or notes without depending on them, so the aggregate lives here.
 */
@Controller('overview')
export class OverviewController {
  constructor(
    private readonly projects: ProjectService,
    private readonly tasks: TaskService,
    private readonly notes: NoteService,
  ) {}

  @Get('projects')
  async projectCards(): Promise<ProjectWithCounts[]> {
    const [projects, taskCounts, noteCounts] = await Promise.all([
      this.projects.list(true),
      this.tasks.countsByProject(),
      this.notes.countsByProject(),
    ]);
    return projects.map((p) => ({
      ...p,
      openTasks: taskCounts.get(p.id)?.open ?? 0,
      doneTasks: taskCounts.get(p.id)?.done ?? 0,
      notes: noteCounts.get(p.id) ?? 0,
    }));
  }
}
