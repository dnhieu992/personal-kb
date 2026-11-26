import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export interface ImageRef {
  key: string;
  url: string;
  name?: string;
  size?: number;
  type?: string;
}

/** A free-form learning-diary entry; the AI extracts review cards from it. */
@Entity('english_journal')
export class EnglishJournalEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ length: 255 }) title: string;
  @Column({ type: 'mediumtext' }) content: string;
  @Column({ type: 'text', nullable: true }) summary: string | null;
  @Column({ type: 'json', nullable: true }) images: ImageRef[] | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
