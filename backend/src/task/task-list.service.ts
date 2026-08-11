import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { TaskList } from './entities/task-list.entity';
import { Task, TaskCategory, TaskStatus } from './entities/task.entity';

@Injectable()
export class TaskListService {
  constructor(
    @InjectRepository(TaskList)
    private readonly repo: Repository<TaskList>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  create(dto: CreateTaskListDto): Promise<TaskList> {
    return this.repo.save(
      this.repo.create({
        name: dto.name.trim().slice(0, 255),
        description: dto.description?.trim() || null,
        category: dto.category ?? TaskCategory.COMPANY,
        targetDate: dto.targetDate ?? null,
        archived: dto.archived ?? false,
      }),
    );
  }

  /** Lists newest first, each annotated with its task and done counts. */
  findAll(includeArchived = false): Promise<TaskList[]> {
    const qb = this.repo
      .createQueryBuilder('l')
      .loadRelationCountAndMap('l.taskCount', 'l.tasks')
      .loadRelationCountAndMap('l.doneCount', 'l.tasks', 'task', (q) =>
        q.andWhere('task.status = :done', { done: TaskStatus.DONE }),
      )
      .orderBy('l.createdAt', 'DESC');
    if (!includeArchived) qb.andWhere('l.archived = false');
    return qb.getMany();
  }

  async findOne(id: string): Promise<TaskList> {
    const list = await this.repo.findOne({ where: { id } });
    if (!list) throw new NotFoundException(`Task list ${id} not found`);
    return list;
  }

  async update(id: string, dto: UpdateTaskListDto): Promise<TaskList> {
    const list = await this.findOne(id);
    Object.assign(list, {
      name: dto.name?.trim() || list.name,
      description:
        dto.description === undefined ? list.description : dto.description,
      category: dto.category ?? list.category,
      targetDate: dto.targetDate === undefined ? list.targetDate : dto.targetDate,
      archived: dto.archived ?? list.archived,
    });
    return this.repo.save(list);
  }

  /** Delete a list; its tasks are kept and unfiled (listId → null). */
  async remove(id: string): Promise<{ deleted: boolean }> {
    const list = await this.findOne(id);
    await this.taskRepo.update({ listId: id }, { listId: null });
    await this.repo.remove(list);
    return { deleted: true };
  }
}
