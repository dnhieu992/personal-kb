import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CefrLevel } from '../../shared/cefr';
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
@Entity('english_course_lesson')
@Index(['unitId', 'position'], { unique: true })
export class CourseLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  unitId: string;

  @Index()
  @Column({ type: 'enum', enum: CefrLevel })
  level: CefrLevel;

  @Column({ type: 'enum', enum: LessonKind, default: LessonKind.LESSON })
  kind: LessonKind;

  @Column({ type: 'int' })
  position: number;

  @Column({ length: 255 })
  title: string;

  @Column({ length: 255 })
  grammar: string;

  @Column({ length: 255 })
  vocabTheme: string;

  @Column({ type: 'text' })
  objective: string;

  @Column({ type: 'json', nullable: true })
  syllabusKeys: string[] | null;

  // --- content ---

  @Column({ type: 'enum', enum: LessonStatus, default: LessonStatus.PENDING })
  status: LessonStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'text', nullable: true })
  intro: string | null;

  @Column({ type: 'longtext', nullable: true })
  theory: string | null;

  @Column({ type: 'json', nullable: true })
  phrases: UsefulPhrase[] | null;

  @Column({ type: 'json', nullable: true })
  vocab: VocabItem[] | null;

  @Column({ type: 'json', nullable: true })
  exercises: Exercise[] | null;

  @Column({ type: 'int', default: 0 })
  skillsVersion: number;

  @Column({ type: 'int', default: 15 })
  minutes: number;

  @Column({ type: 'datetime', nullable: true })
  generatedAt: Date | null;

  // --- progress (single learner) ---

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  bestScore: number | null;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
