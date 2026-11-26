# 0003 — Hand-written migrations, no `synchronize`

Schema changes only through `apps/api/src/platform/database/migrations/*`. They are SQL on purpose: generated
columns, FULLTEXT, CHECK and binary collations are the interesting parts and ORM sync gets them wrong.
Prod runs `node dist/migrate.js` as a separate deploy step before `up -d`; a failed migration stops the deploy
with the old app still serving. Dev may set `MIGRATE_ON_BOOT=true`.
