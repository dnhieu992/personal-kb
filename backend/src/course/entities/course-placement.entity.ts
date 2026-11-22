import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CefrLevel } from '../../knowledge/entities/knowledge.entity';

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
@Entity('course_placement')
export class CoursePlacement {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ enum: CefrLevel, description: 'Level the learner should study' })
  @Column({ type: 'enum', enum: CefrLevel })
  placedLevel: CefrLevel;

  @ApiProperty({ description: 'Percent correct over the items taken' })
  @Column({ type: 'int' })
  score: number;

  @ApiProperty()
  @Column({ type: 'json' })
  levels: PlacementLevelScore[];

  @ApiProperty()
  @Column({ type: 'json' })
  skills: PlacementSkillScore[];

  @ApiProperty({ type: [String], description: 'Syllabus keys answered correctly' })
  @Column({ type: 'json' })
  mastered: string[];

  @ApiProperty({ type: [String], description: 'Syllabus keys answered wrongly' })
  @Column({ type: 'json' })
  weak: string[];

  @ApiProperty({ description: 'itemId → chosen option' })
  @Column({ type: 'json' })
  answers: Record<string, string>;

  @ApiPropertyOptional({ nullable: true, description: 'EF SET score (0–100) entered by the learner' })
  @Column({ type: 'int', nullable: true })
  efsetScore: number | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
