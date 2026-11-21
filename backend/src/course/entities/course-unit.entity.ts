import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CefrLevel } from '../../knowledge/entities/knowledge.entity';

/** A themed unit of the English-for-IT course (e.g. "Daily stand-ups"). */
@Entity('course_unit')
@Index(['level', 'position'], { unique: true })
export class CourseUnit {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ enum: CefrLevel })
  @Column({ type: 'enum', enum: CefrLevel })
  level: CefrLevel;

  @ApiProperty({ description: '1-based order within the level' })
  @Column({ type: 'int' })
  position: number;

  @ApiProperty()
  @Column({ length: 255 })
  title: string;

  @ApiProperty({ description: 'Vietnamese title' })
  @Column({ length: 255 })
  titleVi: string;

  @ApiProperty()
  @Column({ type: 'text' })
  summary: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
