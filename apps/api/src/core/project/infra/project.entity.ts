import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('project')
export class ProjectEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ length: 200 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'char', length: 7, nullable: true }) color: string | null;
  @Column({ name: 'archived_at', type: 'datetime', precision: 3, nullable: true }) archivedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', precision: 3 }) updatedAt: Date;
}
