import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from '../project';
import { TaskModule } from '../task';
import { AttachmentService } from './application/attachment.service';
import { NoteAiService } from './application/note-ai.service';
import { NoteIndexService } from './application/note-index.service';
import { NoteService } from './application/note.service';
import { AttachmentController } from './http/attachment.controller';
import { NoteAiController } from './http/note-ai.controller';
import { NoteController } from './http/note.controller';
import { AttachmentEntity } from './infra/attachment.entity';
import { NoteTagEntity } from './infra/note-tag.entity';
import { NoteEntity } from './infra/note.entity';
import { TagEntity } from './infra/tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NoteEntity, TagEntity, NoteTagEntity, AttachmentEntity]), ProjectModule, TaskModule],
  controllers: [NoteAiController, NoteController, AttachmentController],
  providers: [NoteService, AttachmentService, NoteIndexService, NoteAiService],
  exports: [NoteService, NoteIndexService],
})
export class NoteModule {}
