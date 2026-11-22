import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CefrLevel } from '../../knowledge/entities/knowledge.entity';

/** The learner's destination (single row): from which level to which, at what pace. */
@Entity('course_goal')
export class CourseGoal {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ enum: CefrLevel, description: 'Where the journey starts' })
  @Column({ type: 'enum', enum: CefrLevel })
  startLevel: CefrLevel;

  @ApiProperty({ enum: CefrLevel, description: 'The level to finish (inclusive)' })
  @Column({ type: 'enum', enum: CefrLevel })
  targetLevel: CefrLevel;

  @ApiProperty({ description: 'Lessons per week the learner aims for' })
  @Column({ type: 'int' })
  weeklyLessons: number;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
