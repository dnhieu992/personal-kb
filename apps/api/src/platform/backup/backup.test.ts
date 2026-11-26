import { describe, expect, it } from 'vitest';
import { backupKey, dumpArgs, toPrune } from './backup';

describe('backup helpers', () => {
  it('builds mysqldump args without leaking the password', () => {
    const r = dumpArgs('mysql://pkb:s3cr%40t@127.0.0.1:3306/personal_kb_v2');
    expect(r.database).toBe('personal_kb_v2');
    expect(r.password).toBe('s3cr@t');
    expect(r.args.join(' ')).not.toContain('s3cr');
    expect(r.args).toContain('--single-transaction');
    expect(r.args.at(-1)).toBe('personal_kb_v2');
  });

  it('names backups so they sort by time', () => {
    expect(backupKey('db', new Date('2026-11-26T03:30:00.123Z'))).toBe('backups/db/2026-11-26T03-30-00Z.sql.gz');
  });

  it('keeps only the newest N', () => {
    const keys = ['b/2026-11-03.sql.gz', 'b/2026-11-01.sql.gz', 'b/2026-11-02.sql.gz', 'b/readme.txt'];
    expect(toPrune(keys, 2)).toEqual(['b/2026-11-01.sql.gz']);
    expect(toPrune(keys, 5)).toEqual([]);
  });
});
