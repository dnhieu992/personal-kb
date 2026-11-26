import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { CreateRecurrenceInput, Recurrence, UpdateRecurrenceInput } from '@pkb/contracts';
import { DataSource, Repository } from 'typeorm';
import { ProjectService } from '../../project';
import { Clock } from '../../../platform/clock/clock';
import { newId } from '../../../platform/database/ids';
import { firstDue, resumeDue } from '../domain/recurrence';
import { RecurrenceEntity } from '../infra/recurrence.entity';
import { TaskEntity } from '../infra/task.entity';
import { InstanceFactory } from './instance.factory';
import { toRecurrence } from './task.mapper';

@Injectable()
export class RecurrenceService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(RecurrenceEntity) private readonly repo: Repository<RecurrenceEntity>,
    private readonly projects: ProjectService,
    private readonly instances: InstanceFactory,
    private readonly clock: Clock,
  ) {}

  async list(projectId?: string): Promise<Recurrence[]> {
    const rows = await this.repo.find({ where: projectId ? { projectId } : {}, order: { status: 'ASC', title: 'ASC' } });
    return rows.map(toRecurrence);
  }

  async get(id: string): Promise<Recurrence> {
    return toRecurrence(await this.entity(id));
  }

  /** Creates the series and its first open instance in one transaction. */
  async create(input: CreateRecurrenceInput): Promise<Recurrence> {
    await this.projects.assertExists(input.projectId);
    const rec = this.repo.create({
      id: newId(),
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      rule: input.rule,
      anchorDate: input.anchorDate,
      status: 'active',
      checklistTemplate: input.checklistTemplate,
    });
    await this.db.transaction(async (m) => {
      await m.insert(RecurrenceEntity, rec);
      await this.instances.spawn(m, rec, firstDue(rec.rule, rec.anchorDate), rec.checklistTemplate);
    });
    return this.get(rec.id);
  }

  /**
   * Template edits apply to FUTURE instances (the open one keeps its own copy).
   * Resuming a paused/ended series spawns an instance if none is open.
   */
  async update(id: string, input: UpdateRecurrenceInput): Promise<Recurrence> {
    await this.db.transaction(async (m) => {
      const rec = await m.createQueryBuilder(RecurrenceEntity, 'r').where('r.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!rec) throw new NotFoundException('Recurring series not found');
      const resuming = input.status === 'active' && rec.status !== 'active';
      if (input.title !== undefined) rec.title = input.title;
      if (input.description !== undefined) rec.description = input.description;
      if (input.priority !== undefined) rec.priority = input.priority;
      if (input.rule !== undefined) rec.rule = input.rule;
      if (input.checklistTemplate !== undefined) rec.checklistTemplate = input.checklistTemplate;
      if (input.status !== undefined) rec.status = input.status;
      await m.save(RecurrenceEntity, rec);
      if (resuming) {
        const open = await m.count(TaskEntity, { where: { recurrenceId: id, status: 'todo' } })
          + await m.count(TaskEntity, { where: { recurrenceId: id, status: 'doing' } });
        if (!open) {
          const last = await m
            .createQueryBuilder(TaskEntity, 't')
            .select('MAX(t.dueDate)', 'max')
            .where('t.recurrenceId = :id', { id })
            .getRawOne<{ max: string | null }>();
          const due = resumeDue(rec.rule, last?.max ?? null, rec.anchorDate, this.clock.today());
          await this.instances.spawn(m, rec, due, rec.checklistTemplate);
        }
      }
    });
    return this.get(id);
  }

  private async entity(id: string) {
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new NotFoundException('Recurring series not found');
    return r;
  }
}
