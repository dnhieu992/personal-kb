# ADR 0011 — Semantic search is optional and never blocks a save

**Status:** accepted (Phase 3)

## Decision
- Embeddings: local `all-MiniLM-L6-v2` (transformers.js, 384-dim) — Claude has no embeddings API. Model loads lazily
  on the first job, not at boot. Vectors in Qdrant collection `pkb_v2_notes` (Qdrant bound to 127.0.0.1 + API key).
- Notes are chunked (~900 chars, 150 overlap, title prefix, ≤60 chunks) including extracted attachment text.
- Saves enqueue `note.embed` in the same transaction (outbox); bursts collapse into one pending job.
  Attachment confirm enqueues `attachment.extract-text` (PDF/docx/plain → `attachment.text_content`, also in FULLTEXT).
- Everything is off unless `QDRANT_URL` is set: writes skip the queue, `/search/semantic` answers `enabled:false`,
  `/ask` says it found nothing. Keyword search (FULLTEXT) is always there.
- `/ask` (RAG) answers only from the top passages (score > 0.2) and returns numbered sources.

## Why
SPEC §10: the VPS may not afford two MiniLM processes during the parallel run; the feature must be switchable
without code changes, and a save must never wait for a model.
