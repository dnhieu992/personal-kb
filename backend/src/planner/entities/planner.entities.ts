import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Web port of the "Planner" Mac app. Everything lives in `planner_*` tables and
 * is independent of the older `/plan` feature (`task` / `task_list`).
 *
 * Relations are plain id columns (no TypeORM relations / FKs): the service does
 * the cascades itself, which keeps this module free of entity import cycles.
 * Day keys are `YYYY-MM-DD` strings in varchar(10) so they compare and sort as
 * text, exactly like the SQLite original.
 */

export const AREAS = ['WORK', 'PERSONAL'] as const;
export type Area = (typeof AREAS)[number];

/** quarter = 3 months from periodStart (any day). */
export const GOAL_PERIODS = ['week', 'month', 'quarter'] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const RECURRENCE_KINDS = ['daily', 'weekdays', 'weekly', 'monthly'] as const;
export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number];

export const CORRECTION_KINDS = ['task', 'checklist', 'goal', 'noteTitle', 'text'] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

/** A personal project: the board/list of tasks lives under it (replaces goals + categories in the UI). */
@Entity('planner_project')
export class PlannerProject {
  @ApiProperty() @PrimaryGeneratedColumn() id: number;
  @ApiProperty() @Column({ length: 200 }) name: string;
  @ApiPropertyOptional({ description: 'Markdown' }) @Column({ type: 'text', nullable: true }) description: string | null;
  @ApiProperty() @Column({ type: 'int', default: 0 }) sort: number;
  @ApiProperty() @CreateDateColumn() createdAt: Date;
  @ApiProperty() @UpdateDateColumn() updatedAt: Date;
}

@Entity('planner_category')
export class PlannerCategory {
  @ApiProperty() @PrimaryGeneratedColumn() id: number;
  @ApiProperty() @Column({ length: 120 }) name: string;
  @ApiProperty({ example: '#3B82F6' }) @Column({ length: 9 }) color: string;
  @ApiProperty() @Column({ type: 'int', default: 0 }) sort: number;
  @ApiProperty({ enum: AREAS }) @Column({ length: 10, default: 'PERSONAL' }) area: Area;
}

@Entity('planner_task')
@Index(['area', 'date'])
@Index(['recurrenceId', 'date'], { unique: true })
@Index(['projectId'])
export class PlannerTask {
  @ApiProperty() @PrimaryGeneratedColumn() id: number;
  @ApiProperty() @Column({ length: 500 }) title: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD; null = backlog' })
  @Column({ type: 'varchar', length: 10, nullable: true })
  date: string | null;
  @ApiProperty() @Column({ default: false }) done: boolean;
  @ApiPropertyOptional() @Column({ type: 'datetime', nullable: true }) doneAt: Date | null;
  @ApiProperty({ enum: AREAS }) @Column({ length: 10, default: 'PERSONAL' }) area: Area;
  @ApiPropertyOptional() @Column({ type: 'int', nullable: true }) categoryId: number | null;
  @ApiPropertyOptional() @Column({ type: 'int', nullable: true }) projectId: number | null;
  @ApiProperty({ description: '0 none · 1 low · 2 medium · 3 high' })
  @Column({ type: 'int', default: 0 })
  priority: number;
  @ApiPropertyOptional({ description: 'Minutes after midnight' })
  @Column({ type: 'int', nullable: true })
  startTime: number | null;
  @ApiPropertyOptional({ description: 'Minutes' })
  @Column({ type: 'int', nullable: true })
  duration: number | null;
  @ApiProperty({ type: [String] }) @Column({ type: 'simple-json', nullable: true }) tags: string[] | null;
  @ApiPropertyOptional({ description: 'Markdown' }) @Column({ type: 'text', nullable: true }) notes: string | null;
  @ApiPropertyOptional({ description: 'Markdown outcome summary' })
  @Column({ type: 'text', nullable: true })
  result: string | null;
  @ApiPropertyOptional() @Column({ type: 'datetime', nullable: true }) reminderAt: Date | null;
  /** Set once the Telegram reminder went out (reset when reminderAt changes). */
  @Column({ default: false }) reminded: boolean;
  @ApiPropertyOptional() @Column({ type: 'int', nullable: true }) goalId: number | null;
  @ApiPropertyOptional() @Column({ type: 'int', nullable: true }) recurrenceId: number | null;
  /** A deleted recurring instance stays as a hidden row so the series doesn't regenerate it. */
  @Column({ default: false }) hidden: boolean;
  @ApiProperty() @Column({ default: false }) inProgress: boolean;
  @ApiProperty() @Column({ type: 'int', default: 0 }) sort: number;
  @ApiProperty() @CreateDateColumn() createdAt: Date;
}

@Entity('planner_checklist_item')
@Index(['taskId'])
export class PlannerChecklistItem {
  @ApiProperty() @PrimaryGeneratedColumn() id: number;
  @ApiProperty() @Column({ type: 'int' }) taskId: number;
  @ApiProperty() @Column({ length: 500 }) title: string;
  @ApiProperty() @Column({ default: false }) done: boolean;
  @ApiProperty() @Column({ type: 'int', default: 0 }) sort: number;
}

@Entity('planner_attachment')
@Index(['taskId'])
export class PlannerAttachment {
  @ApiProperty() @PrimaryGeneratedColumn() id: number;
  @ApiProperty() @Column({ type: 'int' }) taskId: number;
  @ApiProperty({ enum: ['link', 'file'] }) @Column({ length: 10 }) kind: 'link' | 'file';
  @ApiProperty() @Column({ length: 500 }) title: string;
  @ApiProperty({ description: 'URL (links and uploaded files)' }) @Column({ type: 'text' }) value: string;
}

@Entity('planner_goal')
export class PlannerGoal {
  @ApiProperty() @PrimaryGeneratedColumn() id: number;
  @ApiProperty() @Column({ length: 500 }) title: string;
  @ApiProperty({ enum: AREAS }) @Column({ length: 10, default: 'PERSONAL' }) area: Area;
  @ApiPropertyOptional() @Column({ type: 'int', nullable: true }) categoryId: number | null;
  @ApiProperty({ enum: GOAL_PERIODS }) @Column({ length: 10 }) period: GoalPeriod;
  @ApiProperty({ description: 'Monday of the week / 1st of the month' })
  @Column({ type: 'varchar', length: 10 })
  periodStart: string;
  @ApiPropertyOptional() @Column({ type: 'text', nullable: true }) notes: string | null;
  @ApiProperty() @Column({ default: false }) done: boolean;
  @ApiProperty() @CreateDateColumn() createdAt: Date;
}

@Entity('planner_recurrence')
export class PlannerRecurrence {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 10 }) kind: RecurrenceKind;
  /** Bitmask over JS getDay(): bit 0 = Sunday … bit 6 = Saturday. */
  @Column({ type: 'int', default: 0 }) weekdays: number;
  @Column({ type: 'int', default: 1 }) monthDay: number;
  @Column({ type: 'varchar', length: 10 }) startDate: string;
  @Column({ type: 'varchar', length: 10, nullable: true }) endDate: string | null;
  // Template copied onto every generated instance.
  @Column({ length: 500 }) title: string;
  @Column({ length: 10, default: 'PERSONAL' }) area: Area;
  @Column({ type: 'int', nullable: true }) categoryId: number | null;
  @Column({ type: 'int', default: 0 }) priority: number;
  @Column({ type: 'int', nullable: true }) startTime: number | null;
  @Column({ type: 'int', nullable: true }) duration: number | null;
  @Column({ type: 'simple-json', nullable: true }) tags: string[] | null;
  /** Minutes after midnight for each instance's reminder. */
  @Column({ type: 'int', nullable: true }) reminderTime: number | null;
  @Column({ type: 'int', nullable: true }) goalId: number | null;
  @Column({ type: 'int', nullable: true }) projectId: number | null;
}

@Entity('planner_note')
@Index(['day', 'area'], { unique: true })
export class PlannerNote {
  @ApiProperty() @PrimaryGeneratedColumn() id: number;
  @ApiProperty() @Column({ length: 500, default: '' }) title: string;
  @ApiProperty({ description: 'Markdown' }) @Column({ type: 'mediumtext', nullable: true }) body: string | null;
  @ApiProperty({ enum: AREAS }) @Column({ length: 10, default: 'PERSONAL' }) area: Area;
  @ApiPropertyOptional() @Column({ type: 'int', nullable: true }) categoryId: number | null;
  @ApiPropertyOptional({ description: 'Set for a "notes for the day" note' })
  @Column({ type: 'varchar', length: 10, nullable: true })
  day: string | null;
  @ApiProperty() @Column({ default: false }) pinned: boolean;
  @ApiProperty() @CreateDateColumn() createdAt: Date;
  @ApiProperty() @UpdateDateColumn() updatedAt: Date;
}

@Entity('planner_correction')
export class PlannerCorrection {
  @ApiProperty() @PrimaryGeneratedColumn() id: number;
  @ApiProperty({ enum: CORRECTION_KINDS }) @Column({ length: 12 }) kind: CorrectionKind;
  @ApiProperty() @Column({ type: 'int', default: 0 }) refId: number;
  @ApiProperty() @Column({ type: 'text' }) original: string;
  @ApiProperty() @Column({ type: 'text' }) corrected: string;
  @ApiProperty() @Column({ type: 'text' }) why: string;
  @ApiProperty() @CreateDateColumn() createdAt: Date;
}
