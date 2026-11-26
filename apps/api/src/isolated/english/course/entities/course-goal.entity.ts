import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CefrLevel } from '../../shared/cefr';

/** The learner's destination (single row): from which level to which, at what pace. */
@Entity('english_course_goal')
export class CourseGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: CefrLevel })
  startLevel: CefrLevel;

  @Column({ type: 'enum', enum: CefrLevel })
  targetLevel: CefrLevel;

  @Column({ type: 'int' })
  weeklyLessons: number;

  @Column({ type: 'boolean', default: false })
  weakFirst: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
