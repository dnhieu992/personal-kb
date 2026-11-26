import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TtsService } from './tts.service';

const MAX_CHARS = 3000;

@Controller('english/tts')
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  @Get()
  async speak(@Query('text') text = '', @Query('rate') rate = '1', @Res() res: Response) {
    const clean = text.trim();
    if (!clean) throw new BadRequestException('text is required');
    if (clean.length > MAX_CHARS) throw new BadRequestException(`text is longer than ${MAX_CHARS} characters`);
    // Snap the rate to 0.05 steps so the cache isn't split by tiny differences.
    const r = Math.min(1.5, Math.max(0.5, Math.round((Number(rate) || 1) * 20) / 20));
    const path = await this.tts.file(clean, r);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('audio/wav').sendFile(path);
  }
}
