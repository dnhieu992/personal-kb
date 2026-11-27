/**
 * Forgot the My Notes passcode? Removes it (notes are kept); the next visit asks for a new one.
 *   node dist/scripts/reset-notes-passcode.js
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadDotenv } from '../platform/config/load-dotenv';
import { dataSourceOptions } from '../platform/database/data-source';

async function main() {
  loadDotenv();
  const ds = await new DataSource(dataSourceOptions(process.env.DATABASE_URL!)).initialize();
  const res = await ds.query('DELETE FROM diary_lock');
  console.log(res.affectedRows ? 'passcode removed — open My Notes to set a new one' : 'no passcode was set');
  await ds.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
