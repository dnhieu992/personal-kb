import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Attachment, MAX_ATTACHMENT_BYTES, RequestUploadInput, RequestUploadResult } from '@pkb/contracts';
import { DataSource, LessThan, Repository } from 'typeorm';
import { newId } from '../../../platform/database/ids';
import { JobService } from '../../../platform/jobs/job.service';
import { STORAGE, StoragePort } from '../../../platform/storage/storage.port';
import { AttachmentEntity } from '../infra/attachment.entity';
import { NoteIndexService } from './note-index.service';
import { DELETE_OBJECT_JOB, NoteService } from './note.service';
import { toAttachment } from './note.mapper';

const PENDING_TTL_MS = 24 * 3_600_000;

/**
 * Direct-to-storage upload in 3 steps — file bytes never pass through the API:
 *   1. requestUpload → pending row + presigned PUT
 *   2. browser PUTs the file straight to R2
 *   3. confirm → API HEADs the object (size/type) and marks it ready
 * Abandoned `pending` rows are swept after 24h.
 */
@Injectable()
export class AttachmentService implements OnModuleInit {
  private readonly logger = new Logger('Attachments');

  constructor(
    private readonly db: DataSource,
    @InjectRepository(AttachmentEntity) private readonly repo: Repository<AttachmentEntity>,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly notes: NoteService,
    private readonly jobs: JobService,
    private readonly index: NoteIndexService,
  ) {}

  onModuleInit() {
    // Idempotent: deleting a missing object is fine, so retries are safe.
    this.jobs.register(DELETE_OBJECT_JOB, async (p: { key: string }) => this.storage.delete(p.key));
  }

  async requestUpload(noteId: string, input: RequestUploadInput): Promise<RequestUploadResult> {
    await this.notes.assertExists(noteId);
    const id = newId();
    const att = this.repo.create({
      id,
      noteId,
      storageKey: `notes/${noteId}/${id}`,
      filename: input.filename,
      mime: input.mime || 'application/octet-stream',
      size: input.size,
      status: 'pending',
    });
    await this.repo.insert(att);
    const { url, headers } = await this.storage.presignPut(att.storageKey, att.mime, att.size);
    return { attachment: toAttachment(att), uploadUrl: url, headers };
  }

  async confirm(id: string): Promise<Attachment> {
    const att = await this.entity(id);
    if (att.status === 'ready') return toAttachment(att);
    const head = await this.storage.head(att.storageKey);
    if (!head) throw new BadRequestException('The file has not been uploaded yet.');
    if (head.size > MAX_ATTACHMENT_BYTES) {
      await this.remove(id);
      throw new BadRequestException('File is larger than 25 MB.');
    }
    att.size = head.size;
    if (head.mime) att.mime = head.mime;
    att.status = 'ready';
    await this.db.transaction(async (m) => {
      await m.save(att);
      // text extraction (PDF/docx/plain) → FULLTEXT + re-embed; other files are searched by name
      await this.index.queueExtract(m, att);
    });
    return toAttachment(att);
  }

  async signedUrl(id: string): Promise<string> {
    const att = await this.entity(id);
    if (att.status !== 'ready') throw new NotFoundException('Attachment not uploaded');
    return this.storage.presignGet(att.storageKey, att.filename, att.mime);
  }

  async remove(id: string): Promise<void> {
    const att = await this.entity(id);
    await this.db.transaction(async (m) => {
      await this.jobs.enqueue(DELETE_OBJECT_JOB, { key: att.storageKey }, { manager: m });
      await m.delete(AttachmentEntity, id);
      if (att.status === 'ready' && att.textStatus === 'done') await this.index.queueEmbed(m, att.noteId);
    });
  }

  @Interval(60 * 60_000)
  async sweepPending(): Promise<number> {
    const stale = await this.repo.find({ where: { status: 'pending', createdAt: LessThan(new Date(Date.now() - PENDING_TTL_MS)) } });
    for (const a of stale) await this.remove(a.id).catch((e) => this.logger.warn(`sweep ${a.id}: ${e.message}`));
    if (stale.length) this.logger.log(`swept ${stale.length} abandoned upload(s)`);
    return stale.length;
  }

  private async entity(id: string) {
    const a = await this.repo.findOneBy({ id });
    if (!a) throw new NotFoundException('Attachment not found');
    return a;
  }
}
