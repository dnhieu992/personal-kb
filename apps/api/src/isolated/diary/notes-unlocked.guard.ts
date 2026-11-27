import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { NOTES_TOKEN_HEADER } from '@pkb/contracts';
import type { Request } from 'express';
import { NotesLockService } from './notes-lock.service';

/** Entry routes need the unlock token the passcode screen hands out (kept in page memory only). */
@Injectable()
export class NotesUnlockedGuard implements CanActivate {
  constructor(private readonly lock: NotesLockService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const h = req.headers[NOTES_TOKEN_HEADER];
    await this.lock.check(Array.isArray(h) ? h[0] : h);
    return true;
  }
}
