import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CefrLevel } from '../../knowledge/entities/knowledge.entity';

/**
 * How the learner does on one exercise of one lesson, across every run (lesson
 * practice, unit reviews, review tests). A wrong answer puts it "in review":
 * due again now, then after 1, 3 and 7 days while it keeps being answered
 * right; three right in a row and it's resolved (`dueAt` back to null).
 */
@Entity('course_exercise_stat')
@Index(['lessonId', 'exerciseIndex'], { unique: true })
export class CourseExerciseStat {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'uuid' })
  lessonId: string;

  @ApiProperty({ description: 'Index into the lesson’s exercises (append-only, so stable)' })
  @Column({ type: 'int' })
  exerciseIndex: number;

  @ApiProperty({ enum: CefrLevel })
  @Column({ type: 'enum', enum: CefrLevel })
  level: CefrLevel;

  @ApiProperty({ description: 'Syllabus points of the lesson (copied for grouping)' })
  @Column({ type: 'json', nullable: true })
  syllabusKeys: string[] | null;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  seen: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  wrong: number;

  @ApiProperty({ description: 'Right answers in a row since the last wrong one' })
  @Column({ type: 'int', default: 0 })
  streak: number;

  @ApiPropertyOptional({ nullable: true, description: 'When it is due for review; null = never wrong or resolved' })
  @Index()
  @Column({ type: 'datetime', nullable: true })
  dueAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'datetime', nullable: true })
  lastWrongAt: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'What was answered the last time it was wrong' })
  @Column({ type: 'json', nullable: true })
  lastAnswer: Record<string, unknown> | null;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
