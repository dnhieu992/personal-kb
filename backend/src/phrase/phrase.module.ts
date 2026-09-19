import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramModule } from '../telegram/telegram.module';
import { Phrase } from './entities/phrase.entity';
import { PhraseCronService } from './phrase-cron.service';
import { PhraseController } from './phrase.controller';
import { PhraseService } from './phrase.service';

@Module({
  imports: [TypeOrmModule.forFeature([Phrase]), TelegramModule],
  controllers: [PhraseController],
  providers: [PhraseService, PhraseCronService],
  exports: [PhraseService],
})
export class PhraseModule {}
