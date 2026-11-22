import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TechNote } from './entities/tech-note.entity';
import { TechNoteController } from './tech-note.controller';
import { TechNoteService } from './tech-note.service';

/**
 * Technical notes (`/tech-notes`): Markdown + when written, no AI. Same shape as
 * the diary today, kept as its own module/table so it can grow separately
 * (tags, titles, search, linking to knowledge entries…).
 */
@Module({
  imports: [TypeOrmModule.forFeature([TechNote])],
  controllers: [TechNoteController],
  providers: [TechNoteService],
})
export class TechNoteModule {}
