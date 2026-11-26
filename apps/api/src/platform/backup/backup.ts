import { spawn } from 'child_process';
import { createGzip } from 'zlib';

/** Pure helpers + the dump itself; the Nest service and the CLI script both use these. */

export function dumpArgs(databaseUrl: string): { args: string[]; password: string; database: string } {
  const u = new URL(databaseUrl);
  const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!database) throw new Error('DATABASE_URL has no database name');
  return {
    database,
    password: decodeURIComponent(u.password),
    args: [
      `--host=${u.hostname}`,
      `--port=${u.port || '3306'}`,
      `--user=${decodeURIComponent(u.username)}`,
      '--single-transaction', // consistent InnoDB snapshot without locking writes
      '--quick',
      '--routines',
      '--triggers',
      '--no-tablespaces', // needs no PROCESS privilege
      '--set-gtid-purged=OFF',
      '--default-character-set=utf8mb4',
      database,
    ],
  };
}

/** `backups/personal_kb_v2/2026-11-26T03-30-00Z.sql.gz` — sorts chronologically by name. */
export function backupKey(database: string, at: Date): string {
  return `backups/${database}/${at.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-')}.sql.gz`;
}

/** Keys to delete so only the newest `keep` remain. */
export function toPrune(keys: string[], keep: number): string[] {
  const sorted = keys.filter((k) => k.endsWith('.sql.gz')).sort();
  return sorted.slice(0, Math.max(0, sorted.length - keep));
}

/** mysqldump | gzip → Buffer. Password goes through MYSQL_PWD, never argv. */
export function dumpGzip(databaseUrl: string, bin = process.env.MYSQLDUMP_BIN || 'mysqldump'): Promise<Buffer> {
  const { args, password } = dumpArgs(databaseUrl);
  return new Promise((resolve, reject) => {
    const run = (argv: string[], retried: boolean) => {
      const child = spawn(bin, argv, { env: { ...process.env, MYSQL_PWD: password } });
      const gz = createGzip();
      const chunks: Buffer[] = [];
      let stderr = '';
      child.stdout.pipe(gz);
      gz.on('data', (c: Buffer) => chunks.push(c));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        // MariaDB's mysqldump (Debian images) doesn't know --set-gtid-purged: retry without it
        if (code !== 0 && !retried && /unknown variable 'set-gtid-purged/.test(stderr)) {
          return run(argv.filter((a) => !a.startsWith('--set-gtid-purged')), true);
        }
        if (code !== 0) return reject(new Error(`mysqldump exited ${code}: ${stderr.trim().slice(0, 500)}`));
        gz.end();
      });
      gz.on('end', () => resolve(Buffer.concat(chunks)));
    };
    run(args, false);
  });
}
