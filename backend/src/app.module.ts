import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ProjectModule } from './project/project.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    KnowledgeModule,
    ProjectModule,
  ],
})
export class AppModule {}
