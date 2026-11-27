import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiaryEntry } from './diary-entry.entity';
import { DiaryLock } from './diary-lock.entity';
import { DiaryController, NotesLockController } from './diary.controller';
import { DiaryService } from './diary.service';
import { NotesLockService } from './notes-lock.service';
import { NotesUnlockedGuard } from './notes-unlocked.guard';

/** ISOLATED: "My Notes" — private day-based notes behind a 6-digit passcode (tables diary_entry, diary_lock). */
@Module({
  imports: [TypeOrmModule.forFeature([DiaryEntry, DiaryLock])],
  controllers: [NotesLockController, DiaryController],
  providers: [DiaryService, NotesLockService, NotesUnlockedGuard],
})
export class DiaryModule {}
