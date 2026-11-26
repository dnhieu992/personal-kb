import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadDotenv } from './platform/config/load-dotenv';
import { dataSourceOptions } from './platform/database/data-source';

/** Deploy step: `node dist/migrate.js` runs BEFORE the new app starts taking requests. */
async function main() {
  loadDotenv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const ds = await new DataSource(dataSourceOptions(url)).initialize();
  const ran = await ds.runMigrations({ transaction: 'each' });
  console.log(ran.length ? `Applied: ${ran.map((m) => m.name).join(', ')}` : 'Schema up to date.');
  await ds.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
