import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { Knowledge } from '../knowledge/entities/knowledge.entity';
import { Task } from '../task/entities/task.entity';
import { TechNote } from '../tech-note/entities/tech-note.entity';
import { EnglishCoachService } from './english-coach.service';

/**
 * Shared English coaching. Has no controller of its own — the routes live with
 * the features that produce the writing (knowledge entries, tasks).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Knowledge, Task, TechNote]), AiModule, EmbeddingModule],
  providers: [EnglishCoachService],
  exports: [EnglishCoachService],
})
export class EnglishModule {}
