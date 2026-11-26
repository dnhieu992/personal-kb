import { defineConfig } from 'vitest/config';

// Unit tests target pure domain code (no Nest, no TypeORM) — they run in milliseconds.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
