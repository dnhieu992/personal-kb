import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnglishCheckDto, SaveCardsDto, TechNoteDto } from './dto/tech-note.dto';
import { EnglishCheckService } from './english-check.service';
import { TechNoteService } from './tech-note.service';

@ApiTags('tech-notes')
@Controller('tech-notes')
export class TechNoteController {
  constructor(
    private readonly service: TechNoteService,
    private readonly english: EnglishCheckService,
  ) {}

  @Post('english/check')
  @ApiOperation({ summary: 'Proofread a note’s English (grammar, word choice, Vietnamese words) — nothing is saved' })
  checkEnglish(@Body() dto: EnglishCheckDto) {
    return this.english.check(dto.content);
  }

  @Post('english/cards')
  @ApiOperation({ summary: 'File chosen words/mistakes as English review cards' })
  saveCards(@Body() dto: SaveCardsDto) {
    return this.english.saveCards(dto.cards, dto.noteId ?? null);
  }

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
