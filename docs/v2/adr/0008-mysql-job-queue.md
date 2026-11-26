# 0008 — Background work = `job` table + in-process worker

No Redis (RAM). Use cases enqueue with the same EntityManager as their write (transactional outbox); the worker
polls every 2s and claims with `SELECT … FOR UPDATE SKIP LOCKED`, retries with quadratic backoff, marks `dead`
after `max_attempts`, re-claims jobs whose lock expired. Handlers must be idempotent. Modules register handlers
on init, so `platform/` stays free of business code. Done jobs are purged after 7 days.
