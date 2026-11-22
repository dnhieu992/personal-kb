import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TechNoteDto } from './dto/tech-note.dto';
import { TechNoteService } from './tech-note.service';

@ApiTags('tech-notes')
@Controller('tech-notes')
export class TechNoteController {
  constructor(private readonly service: TechNoteService) {}

  @Get()
  @ApiOperation({ summary: 'All technical notes, newest first' })
  list() {
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Write a technical note (timestamped now)' })
  create(@Body() dto: TechNoteDto) {
    return this.service.create(dto.content);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edit a note (its written-at time stays)' })
  update(@Param('id') id: string, @Body() dto: TechNoteDto) {
    return this.service.update(id, dto.content);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
