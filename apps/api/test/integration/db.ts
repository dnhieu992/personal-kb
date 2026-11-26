import 'reflect-metadata';
import { createConnection } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../src/platform/database/data-source';

// Vite (vitest) resolves + transpiles these; TypeORM's own glob would require() raw .ts files.
const MIGRATIONS = Object.values(
  (import.meta as unknown as { glob: (p: string, o: object) => Record<string, Record<string, unknown>> }).glob(
    '../../src/platform/database/migrations/*.ts',
    { eager: true },
  ),
).flatMap((m) => Object.values(m)) as (new () => unknown)[];

/** Server URL without a database, e.g. mysql://root:root@127.0.0.1:3308 */
export const IT_URL = process.env.IT_DATABASE_URL;

/** Fresh database with every migration applied; returns a DataSource and a cleanup. */
export async function freshDb(entities: Function[] = []): Promise<{ ds: DataSource; drop: () => Promise<void> }> {
  const name = `pkb_it_${process.pid}_${Date.now().toString(36)}`;
  const admin = await createConnection({ uri: IT_URL! });
  await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const url = `${IT_URL!.replace(/\/$/, '')}/${name}`;
  const ds = await new DataSource({ ...dataSourceOptions(url), migrations: MIGRATIONS as never, entities, logging: false }).initialize();
  await ds.runMigrations({ transaction: 'each' });
  return {
    ds,
    drop: async () => {
      await ds.destroy();
      await admin.query(`DROP DATABASE \`${name}\``);
      await admin.end();
    },
  };
}
