import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { todayKey } from '@pkb/contracts';
import { ENV, Env } from '../config/config';

/**
 * The only place that knows what "now" and "today" are. Inject it instead of calling
 * `new Date()` so use cases are testable with a fixed clock.
 */
@Injectable()
export class Clock {
  constructor(@Inject(ENV) private readonly env: Env) {}
  now(): Date {
    return new Date();
  }
  /** Today's calendar day (YYYY-MM-DD) in APP_TZ. */
  today(): string {
    return todayKey(this.env.APP_TZ, this.now());
  }
}

@Global()
@Module({ providers: [Clock], exports: [Clock] })
export class ClockModule {}
