import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { NoteModule } from './core/note';
import { OverviewModule } from './core/overview';
import { ProjectModule } from './core/project';
import { SearchModule } from './core/search';
import { TaskModule } from './core/task';
import { DiaryModule } from './isolated/diary';
import { ProfileModule } from './platform/profile/profile.module';
import { EnglishModule } from './isolated/english';
import { AiModule } from './platform/ai/ai.module';
import { VectorModule } from './platform/vector/vector.module';
import { BackupModule } from './platform/backup/backup.module';
import { AuthModule } from './platform/auth/auth.module';
import { ClockModule } from './platform/clock/clock';
import { ConfigModule } from './platform/config/config.module';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { ProblemFilter } from './platform/http/problem.filter';
import { JobsModule } from './platform/jobs/jobs.module';
import { StorageModule } from './platform/storage/storage.module';

@Module({
  imports: [
    // platform — infrastructure only, no business rules
    ConfigModule,
    ClockModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    AuthModule,
    JobsModule,
    AiModule,
    VectorModule,
    BackupModule,
    StorageModule,
    // core — the task-centred domain
    ProjectModule,
    TaskModule,
    NoteModule,
    SearchModule,
    OverviewModule,
    // isolated — depend on platform/ only
    EnglishModule,
    DiaryModule,
    ProfileModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ProblemFilter }],
})
export class AppModule {}
