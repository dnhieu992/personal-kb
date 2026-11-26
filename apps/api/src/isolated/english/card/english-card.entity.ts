import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { CefrLevel, EnglishKind } from '../shared/cefr';

/**
 * A reviewable English item (vocab, mistake, grammar point, model sentence). Replaces
 * v1's ENGLISH rows in `knowledge`. Where it was met is TEXT (`source`, `source_url`) —
 * never a foreign key into core tables, so the module can be lifted out on its own.
 */
/** Dedupe lookups use `idx_card_front` — a prefix index (front(191)) created in the migration. */
@Entity('english_card')
export class EnglishCardEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 10 }) kind: EnglishKind;
  @Column({ length: 255 }) title: string;
  /** the English item itself (v1 `content`) */
  @Column({ type: 'text' }) front: string;
  /** translation / explanation / correction (v1 `summary`) */
  @Column({ type: 'text', nullable: true }) meaning: string | null;
  @Column({ name: 'cefr_level', type: 'varchar', length: 2, nullable: true }) cefrLevel: CefrLevel | null;
  @Column({ type: 'boolean', default: false }) hard: boolean;
  @Column({ name: 'review_count', type: 'int', default: 0 }) reviewCount: number;
  @Column({ name: 'correct_count', type: 'int', default: 0 }) correctCount: number;
  @Column({ name: 'last_reviewed_at', type: 'datetime', precision: 3, nullable: true }) lastReviewedAt: Date | null;
  /** the journal entry it was extracted from (same module → a real FK) */
  @Column({ name: 'journal_id', type: 'char', length: 36, nullable: true }) journalId: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) source: string | null;
  @Column({ name: 'source_url', type: 'varchar', length: 500, nullable: true }) sourceUrl: string | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
