import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { v5 } from 'uuid';
import { JobService } from '../../../platform/jobs/job.service';
import { STORAGE, StoragePort } from '../../../platform/storage/storage.port';
import { Embedder } from '../../../platform/vector/embedder';
import { VectorStore } from '../../../platform/vector/vector.store';
import { chunkNote } from '../domain/chunk';
import { AttachmentEntity } from '../infra/attachment.entity';
import { NoteEntity } from '../infra/note.entity';
import { extractText, isExtractable } from './text-extract';

export const EMBED_JOB = 'note.embed';
export const UNEMBED_JOB = 'note.unembed';
export const EXTRACT_JOB = 'attachment.extract-text';
const POINT_NS = '0d4c3a63-5bd2-4b0b-9a8c-7f2e5c1d9e44';

export interface SemanticHit {
  noteId: string;
  score: number;
  /** the matching passage */
  text: string;
  origin: string;
}

/**
 * Background indexing for notes (SPEC: embedding never blocks a save). Writes enqueue jobs
 * in their own transaction (outbox); the worker extracts attachment text and (re)embeds.
 */
@Injectable()
export class NoteIndexService implements OnModuleInit {
  private readonly logger = new Logger('NoteIndex');

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jobs: JobService,
    private readonly vectors: VectorStore,
    private readonly embedder: Embedder,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  onModuleInit() {
    this.jobs.register(EMBED_JOB, (p: { noteId: string }) => this.embed(p.noteId));
    this.jobs.register(UNEMBED_JOB, (p: { noteId: string }) => this.vectors.removeDoc(p.noteId));
    this.jobs.register(EXTRACT_JOB, (p: { attachmentId: string }) => this.extract(p.attachmentId));
  }

  semanticEnabled() {
    return this.vectors.isEnabled();
  }

  /** Call inside the write's transaction. */
  async queueEmbed(m: EntityManager, noteId: string) {
    if (!this.vectors.isEnabled()) return;
    // a burst of edits collapses: a pending embed for this note already covers the latest text
    const [pending] = await m.query(
      "SELECT 1 FROM job WHERE type = ? AND status = 'queued' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.noteId')) = ? LIMIT 1",
      [EMBED_JOB, noteId],
    );
    if (!pending) await this.jobs.enqueue(EMBED_JOB, { noteId }, { manager: m, runAt: new Date(Date.now() + 3000) });
  }

  async queueUnembed(m: EntityManager, noteId: string) {
    if (this.vectors.isEnabled()) await this.jobs.enqueue(UNEMBED_JOB, { noteId }, { manager: m });
  }

  async queueExtract(m: EntityManager, att: Pick<AttachmentEntity, 'id' | 'mime' | 'filename'>) {
    if (isExtractable(att.mime, att.filename)) await this.jobs.enqueue(EXTRACT_JOB, { attachmentId: att.id }, { manager: m });
  }

  async semantic(q: string, limit: number): Promise<SemanticHit[]> {
    const [vector] = await this.embedder.embed([q]);
    const hits = await this.vectors.search(vector, limit * 3);
    // best passage per note
    const best = new Map<string, SemanticHit>();
    for (const h of hits) {
      const noteId = String(h.payload.docId);
      if (!best.has(noteId)) best.set(noteId, { noteId, score: h.score, text: String(h.payload.text ?? ''), origin: String(h.payload.origin ?? 'note') });
    }
    return [...best.values()].slice(0, limit);
  }

  /** Top passages (several per note allowed) — the context for RAG answers. */
  async passages(q: string, limit: number): Promise<SemanticHit[]> {
    const [vector] = await this.embedder.embed([q]);
    const hits = await this.vectors.search(vector, limit);
    return hits.map((h) => ({ noteId: String(h.payload.docId), score: h.score, text: String(h.payload.text ?? ''), origin: String(h.payload.origin ?? 'note') }));
  }

  private async embed(noteId: string) {
    const note = await this.db.getRepository(NoteEntity).findOneBy({ id: noteId });
    if (!note) return this.vectors.removeDoc(noteId);
    const atts = await this.db
      .getRepository(AttachmentEntity)
      .createQueryBuilder('a')
      .addSelect('a.textContent')
      .where('a.noteId = :noteId AND a.status = :s', { noteId, s: 'ready' })
      .getMany();
    const chunks = chunkNote(note.title, note.content, atts.map((a) => ({ filename: a.filename, text: a.textContent })));
    const vectors = await this.embedder.embed(chunks.map((c) => c.text));
    await this.vectors.replaceDoc(
      noteId,
      chunks.map((c, i) => ({ id: v5(`${noteId}:${c.index}`, POINT_NS), vector: vectors[i], payload: { text: c.text, origin: c.origin, title: note.title } })),
    );
    this.logger.debug(`embedded ${noteId} (${chunks.length} chunks)`);
  }

  private async extract(attachmentId: string) {
    const repo = this.db.getRepository(AttachmentEntity);
    const att = await repo.findOneBy({ id: attachmentId });
    if (!att || att.status !== 'ready') return;
    let text: string | null = null;
    let status: 'done' | 'none' | 'failed' = 'none';
    try {
      text = await extractText(await this.storage.get(att.storageKey), att.mime, att.filename);
      status = text ? 'done' : 'none';
    } catch (e) {
      status = 'failed';
      this.logger.warn(`extract ${att.filename}: ${(e as Error).message}`);
    }
    await this.db.transaction(async (m) => {
      await m.update(AttachmentEntity, att.id, { textContent: text, textStatus: status });
      if (text) await this.queueEmbed(m, att.noteId);
    });
  }
}
