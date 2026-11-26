import type { Attachment } from '@pkb/contracts';
import { iso } from '../../../platform/database/cursor';
import { AttachmentEntity } from '../infra/attachment.entity';

export function toAttachment(e: AttachmentEntity): Attachment {
  return {
    id: e.id,
    noteId: e.noteId,
    filename: e.filename,
    mime: e.mime,
    size: e.size,
    status: e.status,
    createdAt: iso(e.createdAt)!,
  };
}
