import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CefrLevel } from '../../shared/cefr';
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
@Entity('english_course_listening')
export class CourseListening {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  lessonId: string;

  @Column({ type: 'enum', enum: CefrLevel })
  level: CefrLevel;

  @Column({ type: 'enum', enum: ListeningStatus, default: ListeningStatus.GENERATING })
  status: ListeningStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'int' })
  targetWords: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  context: string | null;

  @Column({ type: 'longtext', nullable: true })
  passage: string | null;

  @Column({ type: 'longtext', nullable: true })
  translation: string | null;

  @Column({ type: 'int', default: 0 })
  wordCount: number;

  @Column({ type: 'json', nullable: true })
  questions: ListeningQuestion[] | null;

  @Column({ type: 'json', nullable: true })
  ideas: ListeningIdea[] | null;

  // --- progress ---

  @Column({ type: 'int', nullable: true })
  bestScore: number | null;

  @Column({ type: 'datetime', nullable: true })
  passedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'text', nullable: true })
  lastSummary: string | null;

  @Column({ type: 'json', nullable: true })
  lastGrade: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
