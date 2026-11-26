import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CefrLevel } from '../../shared/cefr';

/** A themed unit of the English-for-IT course (e.g. "Daily stand-ups"). */
@Entity('english_course_unit')
@Index(['level', 'position'], { unique: true })
export class CourseUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: CefrLevel })
  level: CefrLevel;

  @Column({ type: 'int' })
  position: number;

  @Column({ length: 255 })
  title: string;

  @Column({ length: 255 })
  titleVi: string;

  @Column({ type: 'text' })
  summary: string;

  @CreateDateColumn()
  createdAt: Date;
}
