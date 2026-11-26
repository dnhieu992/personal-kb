import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ENV, Env } from '../config/config';
import { LocalAdapter } from '../storage/local.adapter';
import { R2Adapter } from '../storage/r2.adapter';
import { StoragePort } from '../storage/storage.port';
import { backupKey, dumpArgs, dumpGzip, toPrune } from './backup';

/**
 * Nightly `mysqldump | gzip` → a SEPARATE bucket (ARCHITECTURE §backup), keep the newest N.
 * Off unless BACKUP_BUCKET is set. A backup never restored is not a backup: see
 * docs/v2/README.md "Restore drill".
 */
@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger('Backup');
  private readonly target: StoragePort | null;

  constructor(@Inject(ENV) private readonly env: Env, private readonly scheduler: SchedulerRegistry) {
    this.target = !env.BACKUP_BUCKET
      ? null
      : env.STORAGE_DRIVER === 'r2'
        ? new R2Adapter({ ...env, R2_BUCKET: env.BACKUP_BUCKET })
        : new LocalAdapter(env);
  }

  onModuleInit() {
    if (!this.target) return;
    const job = new CronJob(this.env.BACKUP_CRON, () => void this.run().catch((e) => this.logger.error(`backup failed: ${e.message}`)), null, false, this.env.APP_TZ);
    this.scheduler.addCronJob('db-backup', job);
    job.start();
    this.logger.log(`nightly backup scheduled (${this.env.BACKUP_CRON} ${this.env.APP_TZ}) → ${this.env.BACKUP_BUCKET}, keep ${this.env.BACKUP_KEEP}`);
  }

  async run(): Promise<{ key: string; bytes: number; pruned: number }> {
    if (!this.target) throw new Error('BACKUP_BUCKET is not set');
    const started = Date.now();
    const { database } = dumpArgs(this.env.DATABASE_URL);
    const body = await dumpGzip(this.env.DATABASE_URL);
    const key = backupKey(database, new Date());
    await this.target.put(key, body, 'application/gzip');
    const old = toPrune(await this.target.list(`backups/${database}/`), this.env.BACKUP_KEEP);
    for (const k of old) await this.target.delete(k);
    this.logger.log(`backup ${key} (${(body.length / 1024).toFixed(0)} KiB) in ${Date.now() - started} ms, pruned ${old.length}`);
    return { key, bytes: body.length, pruned: old.length };
  }
}
