import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TelegramService } from '../telegram/telegram.service';
import { Phrase } from './entities/phrase.entity';
import { PhraseService } from './phrase.service';

/** How many phrases go out in each send (every 8 hours). */
const BATCH_COUNT = 5;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class PhraseCronService {
  private readonly logger = new Logger(PhraseCronService.name);

  constructor(
    private readonly phrases: PhraseService,
    private readonly telegram: TelegramService,
  ) {}

  // Every 8 hours — 00:00, 08:00 and 16:00 Vietnam time (UTC+7).
  @Cron('0 0,8,16 * * *', {
    name: 'daily-phrases',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async runDaily(): Promise<void> {
    await this.sendDailyBatch();
  }

  /**
   * Send the next batch of phrases and count them. Returns the phrases sent
   * (empty if none configured / Telegram not set up). Also used by the manual
   * "send now" endpoint.
   */
  async sendDailyBatch(): Promise<Phrase[]> {
    if (!this.telegram.isConfigured) {
      this.logger.warn('Telegram not configured — skipping daily phrases');
      return [];
    }

    const batch = await this.phrases.nextBatch(BATCH_COUNT);
    if (batch.length === 0) {
      this.logger.log('No phrases in the database — nothing to send');
      return [];
    }

    await this.telegram.send(this.format(batch));
    await this.phrases.markSent(batch.map((p) => p.id));
    this.logger.log(`Sent ${batch.length} phrase(s) to Telegram`);
    return batch;
  }

  private format(batch: Phrase[]): string {
    const header = `📚 <b>Cụm từ tiếng Anh</b> (${batch.length})`;
    const blocks = batch.map((p, i) => {
      const lines = [
        `${i + 1}. <b>${escapeHtml(p.phrase)}</b>`,
        `🇻🇳 ${escapeHtml(p.meaning)}`,
      ];
      if (p.example) lines.push(`📝 <i>${escapeHtml(p.example)}</i>`);
      return lines.join('\n');
    });
    return [header, ...blocks].join('\n\n');
  }
}
