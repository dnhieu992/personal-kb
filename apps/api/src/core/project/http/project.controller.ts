import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateProjectInput, UpdateProjectInput } from '@pkb/contracts';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { ProjectService } from '../application/project.service';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Get()
  list(@Query('archived') archived?: string) {
    return this.projects.list(archived === 'true');
  }

  @Post()
  create(@Body(new ZodPipe(CreateProjectInput)) body: CreateProjectInput) {
    return this.projects.create(body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(UpdateProjectInput)) body: UpdateProjectInput) {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(id);
  }
}
