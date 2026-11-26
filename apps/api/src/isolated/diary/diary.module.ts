import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiaryEntry } from './diary-entry.entity';
import { DiaryController } from './diary.controller';
import { DiaryService } from './diary.service';

/** ISOLATED: plain personal diary (table diary_entry). No AI, no links to tasks/notes. */
@Module({ imports: [TypeOrmModule.forFeature([DiaryEntry])], controllers: [DiaryController], providers: [DiaryService] })
export class DiaryModule {}
