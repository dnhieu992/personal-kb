import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { JobEntity } from '../../src/platform/jobs/job.entity';
import { JobService } from '../../src/platform/jobs/job.service';
import { JobWorker } from '../../src/platform/jobs/job.worker';
import { freshDb, IT_URL } from './db';

describe.skipIf(!IT_URL)('job queue on MySQL 8', () => {
  let ds: DataSource;
  let drop: () => Promise<void>;

  beforeAll(async () => ({ ds, drop } = await freshDb([JobEntity])));
  afterAll(async () => drop?.());

  it('two workers never run the same job (SELECT … FOR UPDATE SKIP LOCKED)', async () => {
    const svc = new JobService(ds);
    const seen: number[] = [];
    svc.register('it.count', async (p: { n: number }) => {
      seen.push(p.n);
      await new Promise((r) => setTimeout(r, 5));
    });
    for (let n = 0; n < 40; n++) await svc.enqueue('it.count', { n });
    const a = new JobWorker(ds, svc);
    const b = new JobWorker(ds, svc);
    for (let i = 0; i < 20 && seen.length < 40; i++) await Promise.all([a.tick(), b.tick()]);
    expect(seen.length).toBe(40);
    expect(new Set(seen).size).toBe(40);
    const [{ n }] = await ds.query("SELECT COUNT(*) AS n FROM job WHERE type = 'it.count' AND status = 'done'");
    expect(Number(n)).toBe(40);
  });

  it('a failing job is retried with backoff, then dead-lettered', async () => {
    const svc = new JobService(ds);
    svc.register('it.fail', async () => {
      throw new Error('boom');
    });
    await svc.enqueue('it.fail', {}, { maxAttempts: 2 });
    const w = new JobWorker(ds, svc);
    await w.tick();
    let [job] = await ds.query("SELECT status, attempts, last_error FROM job WHERE type = 'it.fail'");
    expect(job.status).toBe('queued');
    expect(job.attempts).toBe(1);
    expect(job.last_error).toContain('boom');
    await ds.query("UPDATE job SET run_at = NOW(3) WHERE type = 'it.fail'"); // skip the backoff wait
    await w.tick();
    [job] = await ds.query("SELECT status, attempts FROM job WHERE type = 'it.fail'");
    expect(job.status).toBe('dead');
    expect(job.attempts).toBe(2);
  });
});
