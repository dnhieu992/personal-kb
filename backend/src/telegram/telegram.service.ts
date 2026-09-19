import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendOptions {
  /** Override the default chat/group from TELEGRAM_CHAT_ID. */
  chatId?: string;
  /** Telegram parse mode. Defaults to HTML. Pass undefined for plain text. */
  parseMode?: 'HTML' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
}

/**
 * Sends messages to Telegram via the Bot API. Long text is split at 4000 chars
 * on line boundaries (Telegram's hard limit is 4096). Mirrors the proven sender
 * from the market-analysis app, adapted to NestJS + ConfigService.
 *
 * Config (from /opt/personal-kb/backend.env in prod):
 *   TELEGRAM_BOT_TOKEN  - token from @BotFather
 *   TELEGRAM_CHAT_ID    - default target group id (e.g. -1001234567890)
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('TELEGRAM_BOT_TOKEN')) &&
      Boolean(this.config.get<string>('TELEGRAM_CHAT_ID'));
  }

  /** Send text to the configured (or overridden) chat. Returns messages sent. */
  async send(text: string, opts: SendOptions = {}): Promise<number> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = opts.chatId ?? this.config.get<string>('TELEGRAM_CHAT_ID');

    if (!token || !chatId) {
      this.logger.warn('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing - skipping send');
      return 0;
    }
    const body = text.trim();
    if (body === '') {
      this.logger.warn('empty message - nothing sent');
      return 0;
    }

    const chunks = this.chunk(body);
    for (const [index, part] of chunks.entries()) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: part,
          parse_mode: opts.parseMode ?? 'HTML',
          disable_web_page_preview: opts.disableWebPagePreview ?? true,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || json.ok !== true) {
        this.logger.error(
          `chunk ${index + 1}/${chunks.length} failed: HTTP ${res.status} ${JSON.stringify(json)}`,
        );
        throw new Error(`Telegram sendMessage failed: ${res.status}`);
      }
      // Telegram throttles bursts to one chat; a short gap keeps long reports intact.
      if (index < chunks.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    this.logger.log(`sent ${chunks.length} message(s), ${body.length} chars`);
    return chunks.length;
  }

  private chunk(input: string, maxLen = 4000): string[] {
    const out: string[] = [];
    let rest = input;
    while (rest.length > maxLen) {
      const slice = rest.slice(0, maxLen);
      const cut = slice.lastIndexOf('\n');
      const at = cut > 0 ? cut : maxLen;
      out.push(rest.slice(0, at));
      rest = rest.slice(at + 1);
    }
    if (rest.length > 0) out.push(rest);
    return out;
  }
}
