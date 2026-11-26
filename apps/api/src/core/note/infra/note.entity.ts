import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('note')
export class NoteEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ length: 300 }) title: string;
  @Column({ type: 'mediumtext' }) content: string;
  @Column({ name: 'project_id', type: 'char', length: 36, nullable: true }) projectId: string | null;
  @Column({ name: 'task_id', type: 'char', length: 36, nullable: true }) taskId: string | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
