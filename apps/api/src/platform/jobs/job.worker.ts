import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JobEntity } from './job.entity';
import { JobService } from './job.service';

const POLL_MS = 2000;
const BATCH = 5;
const LOCK_MS = 5 * 60_000;

/** backoff: 10s, 40s, 90s, 160s … capped at 1h */
export function backoffMs(attempts: number): number {
  return Math.min(3_600_000, 10_000 * attempts * attempts);
}

/**
 * In-process worker over the `job` table. Claims with SELECT … FOR UPDATE SKIP LOCKED,
 * so two workers (e.g. during a rolling restart) never take the same job. A crashed run
 * is retried once its lock expires.
 */
@Injectable()
export class JobWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Jobs');
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopping = false;
  private lastPurge = 0;

  constructor(private readonly db: DataSource, private readonly jobs: JobService) {}

  onApplicationBootstrap() {
    if (process.env.JOBS_DISABLED === 'true') return;
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  onApplicationShutdown() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<number> {
    if (this.running || this.stopping) return 0;
    this.running = true;
    try {
      if (Date.now() - this.lastPurge > 3_600_000) {
        this.lastPurge = Date.now();
        // Finished jobs are kept a week for debugging; dead ones stay until looked at.
        await this.db.query("DELETE FROM job WHERE status = 'done' AND updated_at < NOW(3) - INTERVAL 7 DAY");
      }
      const claimed = await this.claim();
      for (const job of claimed) await this.run(job);
      return claimed.length;
    } catch (e) {
      this.logger.error(`tick failed: ${e.message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private claim(): Promise<JobEntity[]> {
    return this.db.transaction(async (m) => {
      const rows: JobEntity[] = await m
        .createQueryBuilder(JobEntity, 'j')
        .where(
          "(j.status = 'queued' AND j.runAt <= NOW(3)) OR (j.status = 'running' AND j.lockedUntil < NOW(3))",
        )
        .orderBy('j.runAt', 'ASC')
        .limit(BATCH)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
      if (!rows.length) return [];
      const lockedUntil = new Date(Date.now() + LOCK_MS);
      for (const r of rows) {
        r.status = 'running';
        r.attempts += 1;
        r.lockedUntil = lockedUntil;
        await m.update(JobEntity, r.id, { status: 'running', attempts: r.attempts, lockedUntil });
      }
      return rows;
    });
  }

  private async run(job: JobEntity) {
    const started = Date.now();
    const handler = this.jobs.handlerFor(job.type);
    try {
      if (!handler) throw new Error(`No handler for job type '${job.type}'`);
      await handler(job.payload);
      await this.db.manager.update(JobEntity, job.id, { status: 'done', lockedUntil: null, lastError: null });
      this.logger.log(`${job.type} ${job.id} done in ${Date.now() - started}ms`);
    } catch (e) {
      const dead = job.attempts >= job.maxAttempts;
      await this.db.manager.update(JobEntity, job.id, {
        status: dead ? 'dead' : 'queued',
        lockedUntil: null,
        lastError: String(e?.stack ?? e).slice(0, 4000),
        runAt: new Date(Date.now() + backoffMs(job.attempts)),
      });
      this.logger.warn(`${job.type} ${job.id} failed (attempt ${job.attempts}${dead ? ', dead' : ''}): ${e.message}`);
    }
  }
}
