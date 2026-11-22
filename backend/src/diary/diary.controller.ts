import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DiaryEntryDto } from './dto/diary-entry.dto';
import { DiaryService } from './diary.service';

@ApiTags('diary')
@Controller('diary')
export class DiaryController {
  constructor(private readonly service: DiaryService) {}

  @Get()
  @ApiOperation({ summary: 'All diary entries, newest first' })
  list() {
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Write a diary entry (timestamped now)' })
  create(@Body() dto: DiaryEntryDto) {
    return this.service.create(dto.content);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edit an entry (its written-at time stays)' })
  update(@Param('id') id: string, @Body() dto: DiaryEntryDto) {
    return this.service.update(id, dto.content);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an entry' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
