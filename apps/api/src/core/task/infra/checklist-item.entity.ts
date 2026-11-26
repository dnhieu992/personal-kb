import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('checklist_item')
export class ChecklistItemEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'task_id', type: 'char', length: 36 }) taskId: string;
  @Column({ length: 500 }) title: string;
  @Column({ type: 'boolean', default: false }) done: boolean;
  @Column({ type: 'varchar', length: 255 }) position: string;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
