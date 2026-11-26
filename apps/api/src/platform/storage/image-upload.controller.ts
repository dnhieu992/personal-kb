import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { RequestImageUploadInput } from '@pkb/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import { newId } from '../database/ids';
import { ZodPipe } from '../http/zod.pipe';
import { STORAGE, StoragePort } from './storage.port';

const encodeKey = (k: string) => Buffer.from(k).toString('base64url');

/**
 * Inline images for modules that embed them in their own rows (English journal, diary)
 * and have no attachment table. Browser PUTs straight to storage (ADR-0007); the image
 * is then referenced by the stable URL `/api/uploads/images/<key>` → 302 to a presigned GET.
 */
@Controller('uploads/images')
export class ImageUploadController {
  constructor(@Inject(STORAGE) private readonly storage: StoragePort) {}

  @Post()
  async request(@Body(new ZodPipe(RequestImageUploadInput)) body: z.infer<typeof RequestImageUploadInput>) {
    const safe = body.filename.replace(/[^\w.-]+/g, '_').slice(-80);
    const key = `images/${newId()}-${safe}`;
    const put = await this.storage.presignPut(key, body.mime, body.size);
    return {
      uploadUrl: put.url,
      headers: put.headers,
      image: { key, url: `/api/uploads/images/${encodeKey(key)}`, name: body.filename, size: body.size, type: body.mime },
    };
  }

  @Get(':key')
  async get(@Param('key') k: string, @Res() res: Response) {
    const key = Buffer.from(k, 'base64url').toString('utf8');
    if (!key.startsWith('images/')) throw new NotFoundException();
    const head = await this.storage.head(key);
    if (!head) throw new NotFoundException();
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.redirect(302, await this.storage.presignGet(key, key.split('/').pop()!, head.mime ?? 'application/octet-stream'));
  }
}
