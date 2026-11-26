import { defineConfig } from 'vitest/config';

// Integration tests hit a REAL MySQL 8 (what unit tests can't prove: generated columns,
// CHECK constraints, FULLTEXT, SKIP LOCKED). Each run creates and drops its own database.
//   IT_DATABASE_URL=mysql://root:root@127.0.0.1:3308 pnpm test:int
export default defineConfig({
  test: { include: ['test/integration/**/*.int.test.ts'], testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false },
});
