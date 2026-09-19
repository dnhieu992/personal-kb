import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Module({
  providers: [TelegramService],
  // Export TelegramService so other modules (e.g. phrases) can send messages.
  exports: [TelegramService],
})
export class TelegramModule {}
