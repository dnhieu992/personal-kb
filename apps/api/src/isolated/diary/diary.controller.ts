import { DiaryEntryInput } from '@pkb/contracts';
import { ZodPipe } from '../../platform/http/zod.pipe';
import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { DiaryService } from './diary.service';

@Controller('diary')
export class DiaryController {
  constructor(private readonly service: DiaryService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body(new ZodPipe(DiaryEntryInput)) dto: DiaryEntryInput) {
    return this.service.create(dto.content);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodPipe(DiaryEntryInput)) dto: DiaryEntryInput) {
    return this.service.update(id, dto.content);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
