import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// The enum comes from outside the entity cycle: it is read while this class is
// being decorated, so it must not depend on task.entity having loaded first.
import { TaskCategory } from './task-enums';
// Task itself is only dereferenced inside the lazy `() => Task` below, which is
// safe across the cycle.
import { Task } from './task.entity';

/**
 * A long-term todo list: a goal or theme that outlives a single day ("Learn
 * Kubernetes", "Q3 refactor"). Tasks may belong to one, or to none at all —
 * a task with no list is just something to do.
 */
@Entity('task_list')
export class TaskList {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Ship the billing revamp' })
  @Column({ length: 255 })
  name: string;

  @ApiPropertyOptional({ description: 'Optional free-text description' })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ enum: TaskCategory })
  @Column({ type: 'enum', enum: TaskCategory, default: TaskCategory.COMPANY })
  category: TaskCategory;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Date the list should be finished by (YYYY-MM-DD)',
  })
  @Column({ type: 'date', nullable: true })
  targetDate: string | null;

  @ApiProperty({ description: 'Archived lists are hidden from the default view' })
  @Column({ type: 'boolean', default: false })
  archived: boolean;

  // Inverse side of Task.list — not a column. onDelete lives on the owning side
  // (Task), so deleting a list unfiles its tasks instead of deleting them.
  @OneToMany(() => Task, (task) => task.list)
  tasks: Task[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  // Populated by loadRelationCountAndMap in the list query; not persisted.
  @ApiPropertyOptional({ description: 'Number of tasks in this list' })
  taskCount?: number;

  @ApiPropertyOptional({ description: 'Number of tasks already done' })
  doneCount?: number;
}
