import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** One row per model call: which module/purpose, how long, did it work. */
@Entity('ai_call')
@Index(['createdAt'])
export class AiCallEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ length: 40 }) module: string;
  @Column({ length: 80 }) purpose: string;
  @Column({ length: 60 }) model: string;
  @Column({ name: 'duration_ms', type: 'int' }) durationMs: number;
  @Column({ type: 'varchar', length: 10 }) status: 'ok' | 'error';
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ name: 'cost_usd', type: 'decimal', precision: 10, scale: 4, nullable: true }) costUsd: string | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
}
