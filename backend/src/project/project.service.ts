import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Knowledge } from '../knowledge/entities/knowledge.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
    @InjectRepository(Knowledge)
    private readonly knowledgeRepo: Repository<Knowledge>,
  ) {}

  async create(dto: CreateProjectDto): Promise<Project> {
    const entity = this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.repo.save(entity);
  }

  /** List projects, newest first, each annotated with its knowledge count. */
  findAll(): Promise<Project[]> {
    return this.repo
      .createQueryBuilder('p')
      .loadRelationCountAndMap('p.knowledgeCount', 'p.knowledge')
      .orderBy('p.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.repo.findOne({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, {
      name: dto.name ?? project.name,
      description: dto.description ?? project.description,
    });
    return this.repo.save(project);
  }

  /** Delete a project; its entries are kept and detached (projectId → null). */
  async remove(id: string): Promise<{ deleted: boolean }> {
    const project = await this.findOne(id);
    await this.knowledgeRepo.update({ projectId: id }, { projectId: null });
    await this.repo.remove(project);
    return { deleted: true };
  }
}
