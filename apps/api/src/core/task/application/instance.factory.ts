import { ConflictException, Injectable } from '@nestjs/common';
import { positionAfter, positionBetween } from '@pkb/contracts';
import { EntityManager } from 'typeorm';
import { isDuplicate } from '../../../platform/database/db-errors';
import { newId } from '../../../platform/database/ids';
import { ChecklistItemEntity } from '../infra/checklist-item.entity';
import { RecurrenceEntity } from '../infra/recurrence.entity';
import { TaskEntity } from '../infra/task.entity';

/** Shared by task completion/skip and recurrence create/resume: cut one open instance from a series. */
@Injectable()
export class InstanceFactory {
  async spawn(m: EntityManager, rec: RecurrenceEntity, due: string, checklist: string[]): Promise<TaskEntity> {
    const position = await nextPosition(m, rec.projectId, 'todo');
    const task = m.create(TaskEntity, {
      id: newId(),
      projectId: rec.projectId,
      title: rec.title,
      description: rec.description,
      status: 'todo',
      priority: rec.priority,
      dueDate: due,
      pinnedFor: null,
      position,
      recurrenceId: rec.id,
      completedAt: null,
    });
    try {
      await m.insert(TaskEntity, task);
    } catch (e) {
      // uq_task_open_slot: the DB guarantees one open instance per series.
      if (isDuplicate(e)) throw new ConflictException('This recurring series already has an open instance.');
      throw e;
    }
    await insertChecklist(m, task.id, checklist);
    return task;
  }
}

export async function nextPosition(m: EntityManager, projectId: string, status: string): Promise<string> {
  const row = await m
    .createQueryBuilder(TaskEntity, 't')
    .select('MAX(t.position)', 'max')
    .where('t.projectId = :projectId AND t.status = :status', { projectId, status })
    .getRawOne<{ max: string | null }>();
  return positionAfter([row?.max ?? null]);
}

export async function insertChecklist(m: EntityManager, taskId: string, titles: string[]): Promise<void> {
  let prev: string | null = null;
  const rows = titles.map((title) => {
    prev = positionBetween(prev, null);
    return { id: newId(), taskId, title, done: false, position: prev };
  });
  if (rows.length) await m.insert(ChecklistItemEntity, rows);
}
