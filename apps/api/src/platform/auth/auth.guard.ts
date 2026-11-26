import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SESSION_COOKIE } from '@pkb/contracts';
import type { Request } from 'express';
import { ENV, Env } from '../config/config';
import { IS_PUBLIC } from './public.decorator';
import { verifySession } from './session';

/** Global guard (APP_GUARD): every route needs a valid session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const exp = verifySession(req.cookies?.[SESSION_COOKIE], this.env.SESSION_SECRET);
    if (!exp) throw new UnauthorizedException('Login required');
    (req as Request & { sessionExp?: number }).sessionExp = exp;
    return true;
  }
}
