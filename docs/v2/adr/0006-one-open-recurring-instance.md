# 0006 — "One open instance per series" is enforced by the database

`task.open_slot` is a STORED generated column `IF(status <> 'done', recurrence_id, NULL)` with a UNIQUE index.
Plain tasks are NULL (unaffected); a second open instance of a series violates the index even under races or a
bug — the API maps it to 409. Because MySQL forbids SET NULL/CASCADE FKs on generated-column bases,
`recurrence_id` is RESTRICT: series are paused/ended, never deleted.
Next due date = pure `nextDue(rule, previousDue)` — calendar-based, independent of completion day.
Completing an instance copies its checklist (reset) to the next; notes/attachments stay. Deleting an open
instance of an active series = skip (next one is created). Resuming spawns an instance on/after today.
