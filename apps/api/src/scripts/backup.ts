/**
 * Run one backup now (same code as the nightly job), e.g. before a risky deploy:
 *   node dist/scripts/backup.js
 * Restore drill (into a scratch DB, never over prod):
 *   gunzip -c 2026-11-26T03-30-00Z.sql.gz | mysql -u root -p personal_kb_v2_restore
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { loadDotenv } from '../platform/config/load-dotenv';
import { ConfigModule } from '../platform/config/config.module';
import { BackupModule } from '../platform/backup/backup.module';
import { BackupService } from '../platform/backup/backup.service';

@Module({ imports: [ConfigModule, ScheduleModule.forRoot(), BackupModule] })
class BackupCli {}

async function main() {
  loadDotenv();
  const app = await NestFactory.createApplicationContext(BackupCli, { logger: ['error', 'warn', 'log'] });
  try {
    console.log(await app.get(BackupService).run());
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
