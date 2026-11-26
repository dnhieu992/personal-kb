/**
 * Module boundaries, checked by machine (CI fails on violation) — see docs/v2/ARCHITECTURE.md §3.3.
 *   platform/  infrastructure only: never imports core/ or isolated/
 *   core/X     may use core/Y ONLY through core/Y/index.ts (its public API)
 *   isolated/  (english, diary) may only use platform/ — so they can be lifted out later
 *   domain/    pure functions: no Nest, no TypeORM
 */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'platform-is-business-free',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^src/(core|isolated)/' },
    },
    {
      name: 'isolated-only-uses-platform',
      severity: 'error',
      from: { path: '^src/isolated/([^/]+)/' },
      to: { path: '^src/(core/|isolated/(?!$1/))' },
    },
    {
      name: 'core-through-public-api',
      comment: 'Import another core module only via its index.ts (no reaching into infra/, domain/, application/).',
      severity: 'error',
      from: { path: '^src/core/([^/]+)/' },
      to: { path: '^src/core/(?!$1/)[^/]+/.+', pathNot: '^src/core/[^/]+/index\\.ts$' },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '(^|/)node_modules/(@nestjs|typeorm)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.ts$' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
