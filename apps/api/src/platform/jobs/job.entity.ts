import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type JobStatus = 'queued' | 'running' | 'done' | 'dead';

@Entity('job')
@Index(['status', 'runAt'])
export class JobEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'json' }) payload: unknown;
  @Column({ type: 'varchar', length: 10 }) status: JobStatus;
  @Column({ name: 'run_at', type: 'datetime', precision: 3 }) runAt: Date;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ name: 'max_attempts', type: 'int', default: 5 }) maxAttempts: number;
  @Column({ name: 'locked_until', type: 'datetime', precision: 3, nullable: true }) lockedUntil: Date | null;
  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError: string | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
