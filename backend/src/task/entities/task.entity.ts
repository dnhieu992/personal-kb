import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CoachStatus,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from './task-enums';
import { TaskList } from './task-list.entity';

// Re-exported so the rest of the module can keep importing them from the entity.
export { CoachStatus, TaskCategory, TaskPriority, TaskStatus };

@Entity('task')
export class Task {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'What to do, in corrected English' })
  @Column({ length: 255 })
  title: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'What the author actually typed, kept when the AI corrected it. ' +
      'Null when the title is exactly what was submitted.',
  })
  @Column({ type: 'text', nullable: true })
  originalTitle: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Optional Markdown detail' })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The notes as typed, kept when the AI rewrote/translated them',
  })
  @Column({ type: 'text', nullable: true })
  originalNotes: string | null;

  @ApiProperty({ enum: TaskStatus })
  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @ApiProperty({ enum: TaskPriority })
  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @ApiProperty({ enum: TaskCategory })
  @Column({ type: 'enum', enum: TaskCategory, default: TaskCategory.COMPANY })
  category: TaskCategory;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The day this is planned for (YYYY-MM-DD). Null = unscheduled backlog.',
  })
  @Column({ type: 'date', nullable: true })
  planDate: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Hard deadline (YYYY-MM-DD)' })
  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Long-term list this task belongs to (null = standalone)',
  })
  @Column({ type: 'uuid', nullable: true })
  listId: string | null;

  // Owning side of the relation. Deleting the list unfiles its tasks rather than
  // deleting them — a task can live without a list.
  @ManyToOne(() => TaskList, (list) => list.tasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'listId' })
  list?: TaskList;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  // --- English coaching (the same pass knowledge entries get) ---

  @ApiProperty({ enum: CoachStatus })
  @Column({ type: 'enum', enum: CoachStatus, default: CoachStatus.PENDING })
  coachStatus: CoachStatus;

  @ApiProperty({
    description: 'Review cards collected from this task on the last coaching pass',
  })
  @Column({ type: 'int', default: 0 })
  collectedCount: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
