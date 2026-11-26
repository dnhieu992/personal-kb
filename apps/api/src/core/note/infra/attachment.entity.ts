import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('attachment')
export class AttachmentEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'note_id', type: 'char', length: 36 }) noteId: string;
  @Column({ name: 'storage_key', length: 500 }) storageKey: string;
  @Column({ length: 255 }) filename: string;
  @Column({ length: 200 }) mime: string;
  @Column({ type: 'bigint', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } }) size: number;
  @Column({ type: 'varchar', length: 10 }) status: 'pending' | 'ready';
  /** extracted text (PDF/docx/plain) — never loaded unless asked for */
  @Column({ name: 'text_content', type: 'mediumtext', nullable: true, select: false }) textContent: string | null;
  @Column({ name: 'text_status', type: 'varchar', length: 10, nullable: true }) textStatus: 'done' | 'none' | 'failed' | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
