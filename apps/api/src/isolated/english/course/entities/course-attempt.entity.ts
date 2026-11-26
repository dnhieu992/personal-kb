import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One run through a lesson's practice. */
@Entity('english_course_attempt')
export class CourseAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  lessonId: string;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'int' })
  correct: number;

  @Column({ type: 'int' })
  total: number;

  @Column({ type: 'json', nullable: true })
  answers: unknown[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
