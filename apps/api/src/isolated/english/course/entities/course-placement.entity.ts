import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CefrLevel } from '../../shared/cefr';

export interface PlacementLevelScore {
  level: CefrLevel;
  correct: number;
  total: number;
  /** False when the test stopped before this block. */
  taken: boolean;
}

export interface PlacementSkillScore {
  skill: string;
  correct: number;
  total: number;
}

/** One placement test run. The latest row is the learner's current placement. */
@Entity('english_course_placement')
export class CoursePlacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: CefrLevel })
  placedLevel: CefrLevel;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'json' })
  levels: PlacementLevelScore[];

  @Column({ type: 'json' })
  skills: PlacementSkillScore[];

  @Column({ type: 'json' })
  mastered: string[];

  @Column({ type: 'json' })
  weak: string[];

  @Column({ type: 'json' })
  answers: Record<string, string>;

  @Column({ type: 'int', nullable: true })
  efsetScore: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
