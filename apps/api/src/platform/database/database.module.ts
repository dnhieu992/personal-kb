import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV, Env } from '../config/config';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        ...dataSourceOptions(env.DATABASE_URL),
        migrationsRun: env.MIGRATE_ON_BOOT,
      }),
    }),
  ],
})
export class DatabaseModule {}
