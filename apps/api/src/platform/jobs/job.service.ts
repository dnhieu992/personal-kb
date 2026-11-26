import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { newId } from '../database/ids';
import { JobEntity } from './job.entity';

export type JobHandler = (payload: any) => Promise<void>;

/**
 * Transactional outbox: enqueue with the SAME EntityManager as the business write, so the
 * job exists iff the change committed. Handlers must be idempotent (at-least-once).
 */
@Injectable()
export class JobService {
  private readonly handlers = new Map<string, JobHandler>();

  constructor(private readonly db: DataSource) {}

  /** Modules register their handlers on init — platform never imports core code. */
  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) throw new Error(`Job handler '${type}' registered twice`);
    this.handlers.set(type, handler);
  }

  handlerFor(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }

  async enqueue(type: string, payload: unknown, opts: { manager?: EntityManager; runAt?: Date; maxAttempts?: number } = {}) {
    const m = opts.manager ?? this.db.manager;
    await m.insert(JobEntity, {
      id: newId(),
      type,
      payload: payload as object,
      status: 'queued',
      runAt: opts.runAt ?? new Date(),
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? 5,
    });
  }
}
