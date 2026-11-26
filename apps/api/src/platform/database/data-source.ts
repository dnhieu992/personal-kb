import { DataSourceOptions } from 'typeorm';
import { join } from 'path';

/**
 * Shared TypeORM options for the app and the standalone migrator.
 * `synchronize` is OFF everywhere — the schema only changes through migrations.
 */
export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'mysql',
    url,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    // DATE columns are calendar days: keep them as 'YYYY-MM-DD' strings, never Date objects.
    dateStrings: ['DATE'],
    entities: [join(__dirname, '../../**/*.entity.{js,ts}')],
    migrations: [join(__dirname, 'migrations/*.{js,ts}')],
    migrationsTableName: 'schema_migrations',
    synchronize: false,
    logging: ['error', 'warn', 'migration'],
  };
}
