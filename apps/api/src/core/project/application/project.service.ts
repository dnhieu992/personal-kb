import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@pkb/contracts';
import { Repository } from 'typeorm';
import { Clock } from '../../../platform/clock/clock';
import { iso } from '../../../platform/database/cursor';
import { newId } from '../../../platform/database/ids';
import { ProjectEntity } from '../infra/project.entity';

export function toProject(e: ProjectEntity): Project {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    color: e.color,
    archivedAt: iso(e.archivedAt),
    createdAt: iso(e.createdAt)!,
    updatedAt: iso(e.updatedAt)!,
  };
}

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(ProjectEntity) private readonly repo: Repository<ProjectEntity>,
    private readonly clock: Clock,
  ) {}

  async list(includeArchived = false): Promise<Project[]> {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.archivedAt IS NULL', 'DESC').addOrderBy('p.name', 'ASC');
    if (!includeArchived) qb.where('p.archivedAt IS NULL');
    return (await qb.getMany()).map(toProject);
  }

  async get(id: string): Promise<Project> {
    return toProject(await this.entity(id));
  }

  /** Public for other modules: a lookup map for labelling rows. */
  async byIds(ids: string[]): Promise<Map<string, Project>> {
    if (!ids.length) return new Map();
    const rows = await this.repo.createQueryBuilder('p').whereInIds([...new Set(ids)]).getMany();
    return new Map(rows.map((r) => [r.id, toProject(r)]));
  }

  async assertExists(id: string): Promise<void> {
    await this.entity(id);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const e = this.repo.create({ id: newId(), name: input.name, description: input.description ?? null, color: input.color ?? null, archivedAt: null });
    await this.repo.insert(e);
    return this.get(e.id);
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const e = await this.entity(id);
    if (input.name !== undefined) e.name = input.name;
    if (input.description !== undefined) e.description = input.description;
    if (input.color !== undefined) e.color = input.color;
    if (input.archived !== undefined) e.archivedAt = input.archived ? e.archivedAt ?? this.clock.now() : null;
    await this.repo.save(e);
    return this.get(id);
  }

  /** FK RESTRICT refuses while tasks/notes still point here → 409 via ProblemFilter. */
  async remove(id: string): Promise<void> {
    await this.entity(id);
    await this.repo.delete(id);
  }

  private async entity(id: string): Promise<ProjectEntity> {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('Project not found');
    return e;
  }
}
