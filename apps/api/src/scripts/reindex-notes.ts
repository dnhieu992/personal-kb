/**
 * Queue a `note.embed` job for every note (after turning semantic search on, or changing the model):
 *   node dist/scripts/reindex-notes.js
 * The running API's worker does the embedding in the background.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadDotenv } from '../platform/config/load-dotenv';
import { dataSourceOptions } from '../platform/database/data-source';
import { JobService } from '../platform/jobs/job.service';

const EMBED_JOB = 'note.embed'; // = core/note EMBED_JOB (scripts may not import core)

async function main() {
  loadDotenv();
  const ds = await new DataSource(dataSourceOptions(process.env.DATABASE_URL!)).initialize();
  const jobs = new JobService(ds);
  const rows: { id: string }[] = await ds.query('SELECT id FROM note');
  await ds.transaction(async (m) => {
    for (const r of rows) await jobs.enqueue(EMBED_JOB, { noteId: r.id }, { manager: m });
  });
  console.log(`queued ${rows.length} note(s) for embedding`);
  await ds.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
