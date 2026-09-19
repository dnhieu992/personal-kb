import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { EnglishModule } from './english/english.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { PhraseModule } from './phrase/phrase.module';
import { ProjectModule } from './project/project.module';
import { StorageModule } from './storage/storage.module';
import { TaskModule } from './task/task.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // Dev convenience: auto-create the schema. Disable + use migrations in prod.
        synchronize: true,
      }),
    }),
    StorageModule,
    EmbeddingModule,
    AiModule,
    EnglishModule,
    KnowledgeModule,
    ProjectModule,
    TaskModule,
    TelegramModule,
    PhraseModule,
  ],
})
export class AppModule {}
