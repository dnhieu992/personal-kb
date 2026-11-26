# 0009 — A note belongs to a task XOR a project XOR nothing — enforced by a CHECK

ARCHITECTURE.md proposed FK `SET NULL` and gave up on a CHECK (MySQL forbids CHECKs on columns with SET NULL /
CASCADE actions). Tested on MySQL 8: with `ON DELETE RESTRICT` the CHECK is accepted. So:
`note.task_id`/`note.project_id` are RESTRICT + `CHECK (project_id IS NULL OR task_id IS NULL)`.
Deleting a task or project that still has notes returns 409 ("move or delete those first") — this also answers
the two open questions in ARCHITECTURE §12 (no silent orphaning; projects can be archived instead).
"Notes of project X" = notes on X plus notes on X's tasks.
