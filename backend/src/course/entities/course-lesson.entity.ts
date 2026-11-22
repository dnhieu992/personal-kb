import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CefrLevel } from '../../knowledge/entities/knowledge.entity';
import { Exercise, UsefulPhrase, VocabItem } from '../course.types';

/** Where a lesson's AI-written content is. */
export enum LessonStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/** A taught lesson, or a unit review built from the unit's lessons' exercises (no AI). */
export enum LessonKind {
  LESSON = 'LESSON',
  REVIEW = 'REVIEW',
}

/**
 * One lesson: the plan (title, grammar point, vocab theme) is written when the
 * level's outline is generated; the content (theory, vocab, exercises) is filled
 * in afterwards, one lesson at a time. The app has one learner, so progress
 * lives on the row too (`completedAt`, `bestScore`).
 */
@Entity('course_lesson')
@Index(['unitId', 'position'], { unique: true })
export class CourseLesson {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'uuid' })
  unitId: string;

  @ApiProperty({ enum: CefrLevel })
  @Index()
  @Column({ type: 'enum', enum: CefrLevel })
  level: CefrLevel;

  @ApiProperty({ enum: LessonKind })
  @Column({ type: 'enum', enum: LessonKind, default: LessonKind.LESSON })
  kind: LessonKind;

  @ApiProperty({ description: '1-based order within the unit' })
  @Column({ type: 'int' })
  position: number;

  @ApiProperty()
  @Column({ length: 255 })
  title: string;

  @ApiProperty({ description: 'The grammar point the lesson teaches' })
  @Column({ length: 255 })
  grammar: string;

  @ApiProperty()
  @Column({ length: 255 })
  vocabTheme: string;

  @ApiProperty({ description: 'Vietnamese one-liner: what you can do after it' })
  @Column({ type: 'text' })
  objective: string;

  @ApiPropertyOptional({
    nullable: true,
    type: [String],
    description: 'Core Inventory points it teaches (syllabus.ts keys); null = not mapped yet',
  })
  @Column({ type: 'json', nullable: true })
  syllabusKeys: string[] | null;

  // --- content ---

  @ApiProperty({ enum: LessonStatus })
  @Column({ type: 'enum', enum: LessonStatus, default: LessonStatus.PENDING })
  status: LessonStatus;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  intro: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Markdown, Vietnamese explanations' })
  @Column({ type: 'longtext', nullable: true })
  theory: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'json', nullable: true })
  phrases: UsefulPhrase[] | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'json', nullable: true })
  vocab: VocabItem[] | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'json', nullable: true })
  exercises: Exercise[] | null;

  @ApiProperty({ description: 'Estimated minutes to finish' })
  @Column({ type: 'int', default: 15 })
  minutes: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'datetime', nullable: true })
  generatedAt: Date | null;

  // --- progress (single learner) ---

  @ApiPropertyOptional({ nullable: true, description: 'First time the practice was passed' })
  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'int', nullable: true })
  bestScore: number | null;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
