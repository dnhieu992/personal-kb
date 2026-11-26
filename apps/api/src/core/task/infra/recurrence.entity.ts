import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { RecurrenceRule, RecurrenceStatus } from '@pkb/contracts';

/** A recurring series = the template its instances (rows in `task`) are cut from. */
@Entity('task_recurrence')
export class RecurrenceEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'project_id', type: 'char', length: 36 }) projectId: string;
  @Column({ length: 300 }) title: string;
  @Column({ type: 'mediumtext', nullable: true }) description: string | null;
  @Column({ type: 'tinyint' }) priority: number;
  @Column({ type: 'json' }) rule: RecurrenceRule;
  @Column({ name: 'anchor_date', type: 'date' }) anchorDate: string;
  @Column({ type: 'varchar', length: 10 }) status: RecurrenceStatus;
  @Column({ name: 'checklist_template', type: 'json' }) checklistTemplate: string[];
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
