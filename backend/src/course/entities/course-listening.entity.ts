import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CefrLevel } from '../../knowledge/entities/knowledge.entity';
import { ListeningIdea, ListeningQuestion } from '../course.types';

/** Where a listening task's AI-written content is. */
export enum ListeningStatus {
  GENERATING = 'GENERATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/**
 * The listening task of one lesson: a spoken passage (read aloud by the
 * browser, 100–500 words growing with the lesson's place in the course),
 * comprehension questions, and the key ideas a summary is graded against.
 * Written by the AI on first open, then kept. Progress (single learner) on the row.
 */
@Entity('course_listening')
export class CourseListening {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  lessonId: string;

  @ApiProperty({ enum: CefrLevel })
  @Column({ type: 'enum', enum: CefrLevel })
  level: CefrLevel;

  @ApiProperty({ enum: ListeningStatus })
  @Column({ type: 'enum', enum: ListeningStatus, default: ListeningStatus.GENERATING })
  status: ListeningStatus;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @ApiProperty({ description: 'Words the passage was asked to have' })
  @Column({ type: 'int' })
  targetWords: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Vietnamese: who is speaking, where, why' })
  @Column({ type: 'text', nullable: true })
  context: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'What the browser reads aloud' })
  @Column({ type: 'longtext', nullable: true })
  passage: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'longtext', nullable: true })
  translation: string | null;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  wordCount: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'json', nullable: true })
  questions: ListeningQuestion[] | null;

  @ApiPropertyOptional({ nullable: true, description: 'Main ideas a summary must cover' })
  @Column({ type: 'json', nullable: true })
  ideas: ListeningIdea[] | null;

  // --- progress ---

  @ApiPropertyOptional({ nullable: true, description: 'Best summary score (% of ideas covered)' })
  @Column({ type: 'int', nullable: true })
  bestScore: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'datetime', nullable: true })
  passedAt: Date | null;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  lastSummary: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Latest grade, so the result survives a reload' })
  @Column({ type: 'json', nullable: true })
  lastGrade: Record<string, unknown> | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
