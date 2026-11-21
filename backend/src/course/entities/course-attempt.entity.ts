import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One run through a lesson's practice. */
@Entity('course_attempt')
export class CourseAttempt {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Index()
  @Column({ type: 'uuid' })
  lessonId: string;

  @ApiProperty({ description: '0–100' })
  @Column({ type: 'int' })
  score: number;

  @ApiProperty()
  @Column({ type: 'int' })
  correct: number;

  @ApiProperty()
  @Column({ type: 'int' })
  total: number;

  @ApiProperty({ description: 'What was answered, per exercise' })
  @Column({ type: 'json', nullable: true })
  answers: unknown[] | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
