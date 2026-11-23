import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { EnglishModule } from '../english/english.module';
import { EnglishCheckService } from './english-check.service';
import { TechNote } from './entities/tech-note.entity';
import { TechNoteController } from './tech-note.controller';
import { TechNoteService } from './tech-note.service';

/**
 * Technical notes (`/tech-notes`): Markdown + when written. Same shape as the
 * diary, kept as its own module/table so it can grow separately. On request the
 * AI proofreads a note's English and files what the writer didn't know as
 * review cards (`EnglishCheckService`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([TechNote]), AiModule, EnglishModule],
  controllers: [TechNoteController],
  providers: [TechNoteService, EnglishCheckService],
})
export class TechNoteModule {}
