import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { TaskStatus } from '@pkb/contracts';

/** Note: the generated `open_slot` column is DB-only (see Init migration) and not mapped. */
@Entity('task')
export class TaskEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'project_id', type: 'char', length: 36 }) projectId: string;
  @Column({ length: 300 }) title: string;
  @Column({ type: 'mediumtext', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 10 }) status: TaskStatus;
  @Column({ type: 'tinyint' }) priority: number;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate: string | null;
  @Column({ name: 'pinned_for', type: 'date', nullable: true }) pinnedFor: string | null;
  @Column({ type: 'varchar', length: 255 }) position: string;
  @Column({ name: 'recurrence_id', type: 'char', length: 36, nullable: true }) recurrenceId: string | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true }) completedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
