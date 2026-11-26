import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LoginInput, Me, SESSION_COOKIE } from '@pkb/contracts';
import type { CookieOptions, Request, Response } from 'express';
import { ENV, Env } from '../config/config';
import { ZodPipe } from '../http/zod.pipe';
import { verifyPassword } from './password';
import { Public } from './public.decorator';
import { signSession } from './session';

@Controller('auth')
export class AuthController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  private cookieOpts(): CookieOptions {
    return { httpOnly: true, secure: this.env.COOKIE_SECURE, sameSite: 'lax', path: '/' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(LoginInput)) body: LoginInput, @Res({ passthrough: true }) res: Response): Promise<Me> {
    if (!(await verifyPassword(body.password, this.env.AUTH_PASSWORD_HASH))) {
      throw new UnauthorizedException('Wrong password');
    }
    const exp = Date.now() + this.env.SESSION_DAYS * 86_400_000;
    res.cookie(SESSION_COOKIE, signSession(exp, this.env.SESSION_SECRET), { ...this.cookieOpts(), expires: new Date(exp) });
    return { authenticated: true, expiresAt: new Date(exp).toISOString() };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOpts());
  }

  @Get('me')
  me(@Req() req: Request & { sessionExp?: number }): Me {
    return { authenticated: true, expiresAt: new Date(req.sessionExp!).toISOString() };
  }
}
