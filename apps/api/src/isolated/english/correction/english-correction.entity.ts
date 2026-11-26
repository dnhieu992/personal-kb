import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** A fix the learner accepted (Check English) or v1's planner auto-corrections. */
@Entity('english_correction')
export class EnglishCorrectionEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ length: 20 }) kind: string;
  @Column({ type: 'text' }) original: string;
  @Column({ type: 'text' }) corrected: string;
  @Column({ type: 'text' }) why: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) source: string | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
}
