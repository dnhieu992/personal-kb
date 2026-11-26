import { Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MAX_ATTACHMENT_BYTES } from '@pkb/contracts';
import { Public } from '../auth/public.decorator';
import { LocalAdapter } from './local.adapter';
import { STORAGE, StoragePort } from './storage.port';

/** Only active with STORAGE_DRIVER=local. Auth = the URL signature (like a presigned R2 URL). */
@Controller('storage/local')
export class LocalStorageController {
  constructor(@Inject(STORAGE) private readonly storage: StoragePort) {}

  private adapter(): LocalAdapter {
    if (!(this.storage instanceof LocalAdapter)) throw new NotFoundException();
    return this.storage;
  }

  @Public()
  @Put(':key')
  async put(@Param('key') k: string, @Query('exp') exp: string, @Query('sig') sig: string, @Req() req: Request) {
    const a = this.adapter();
    const key = Buffer.from(k, 'base64url').toString('utf8');
    if (!a.verify('put', key, Number(exp), sig)) throw new ForbiddenException('Bad or expired signature');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > MAX_ATTACHMENT_BYTES) throw new ForbiddenException('Too large');
      chunks.push(c as Buffer);
    }
    await a.write(key, Buffer.concat(chunks), String(req.headers['content-type'] ?? 'application/octet-stream'));
    return { ok: true };
  }

  @Public()
  @Get(':key')
  async get(
    @Param('key') k: string,
    @Query() q: { exp: string; sig: string; d?: string; t?: string },
    @Res() res: Response,
  ) {
    const a = this.adapter();
    const key = Buffer.from(k, 'base64url').toString('utf8');
    if (!a.verify('get', key, Number(q.exp), q.sig, q.d ?? '')) throw new ForbiddenException('Bad or expired signature');
    if (!(await a.head(key))) throw new NotFoundException();
    res.setHeader('Content-Type', q.t ?? 'application/octet-stream');
    if (q.d) res.setHeader('Content-Disposition', q.d);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(a.pathOf(key));
  }
}
