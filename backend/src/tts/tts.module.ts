import { Module } from '@nestjs/common';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';

/** Server-side English speech for the course (GET /tts), see TtsService. */
@Module({
  controllers: [TtsController],
  providers: [TtsService],
})
export class TtsModule {}
