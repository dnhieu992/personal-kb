import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChangePasscodeInput, DiaryEntryInput, UnlockInput } from '@pkb/contracts';
import { ZodPipe } from '../../platform/http/zod.pipe';
import { DiaryService } from './diary.service';
import { NotesLockService } from './notes-lock.service';
import { NotesUnlockedGuard } from './notes-unlocked.guard';

/** Passcode lock for My Notes. Wrong guesses are throttled (5/min). */
@Controller('diary/lock')
export class NotesLockController {
  constructor(private readonly lock: NotesLockService) {}

  @Get()
  state() {
    return this.lock.state();
  }

  @Post('setup')
  setup(@Body(new ZodPipe(UnlockInput)) dto: UnlockInput) {
    return this.lock.setup(dto.passcode);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('unlock')
  @HttpCode(200)
  unlock(@Body(new ZodPipe(UnlockInput)) dto: UnlockInput) {
    return this.lock.unlock(dto.passcode);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change')
  @HttpCode(200)
  change(@Body(new ZodPipe(ChangePasscodeInput)) dto: ChangePasscodeInput) {
    return this.lock.change(dto.current, dto.next);
  }
}

@Controller('diary')
@UseGuards(NotesUnlockedGuard)
export class DiaryController {
  constructor(private readonly service: DiaryService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body(new ZodPipe(DiaryEntryInput)) dto: DiaryEntryInput) {
    return this.service.create(dto.content, dto.entryDate);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodPipe(DiaryEntryInput)) dto: DiaryEntryInput) {
    return this.service.update(id, dto.content, dto.entryDate);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
