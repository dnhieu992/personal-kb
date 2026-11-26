import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CefrLevel } from '../../shared/cefr';

/**
 * How the learner does on one exercise of one lesson, across every run (lesson
 * practice, unit reviews, review tests). A wrong answer puts it "in review":
 * due again now, then after 1, 3 and 7 days while it keeps being answered
 * right; three right in a row and it's resolved (`dueAt` back to null).
 */
@Entity('english_course_exercise_stat')
@Index(['lessonId', 'exerciseIndex'], { unique: true })
export class CourseExerciseStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  lessonId: string;

  @Column({ type: 'int' })
  exerciseIndex: number;

  @Column({ type: 'enum', enum: CefrLevel })
  level: CefrLevel;

  @Column({ type: 'json', nullable: true })
  syllabusKeys: string[] | null;

  @Column({ type: 'int', default: 0 })
  seen: number;

  @Column({ type: 'int', default: 0 })
  wrong: number;

  @Column({ type: 'int', default: 0 })
  streak: number;

  @Index()
  @Column({ type: 'datetime', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastWrongAt: Date | null;

  @Column({ type: 'json', nullable: true })
  lastAnswer: Record<string, unknown> | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
