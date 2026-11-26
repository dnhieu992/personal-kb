import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AttachmentService } from '../application/attachment.service';

@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachments: AttachmentService) {}

  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachments.confirm(id);
  }

  @Get(':id/url')
  async url(@Param('id', ParseUUIDPipe) id: string) {
    return { url: await this.attachments.signedUrl(id) };
  }

  /**
   * Stable link used inside markdown (`![](/api/attachments/<id>/raw)`): needs the session
   * cookie, then redirects to a fresh short-lived presigned URL.
   */
  @Get(':id/raw')
  async raw(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.redirect(302, await this.attachments.signedUrl(id));
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachments.remove(id);
  }
}
