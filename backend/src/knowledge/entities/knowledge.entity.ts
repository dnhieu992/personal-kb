import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';

export enum KnowledgeType {
  BUG_FIX = 'BUG_FIX',
  HOW_TO = 'HOW_TO',
  ARCHITECTURE = 'ARCHITECTURE',
  INSIGHT = 'INSIGHT',
  DAILY_LOG = 'DAILY_LOG',
  ENGLISH = 'ENGLISH',
}

/** CEFR difficulty bands, used for ENGLISH entries. */
export enum CefrLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

@Entity('knowledge')
export class Knowledge {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ length: 255 })
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  content: string;

  @ApiProperty({ type: [String], example: ['nestjs', 'typeorm'] })
  @Column({ type: 'simple-json', nullable: true })
  tags: string[];

  @ApiProperty({ enum: KnowledgeType })
  @Column({ type: 'enum', enum: KnowledgeType, default: KnowledgeType.INSIGHT })
  type: KnowledgeType;

  @ApiProperty({ type: [String], description: 'Extracted code snippets' })
  @Column({ type: 'simple-json', nullable: true })
  codeSnippets: string[];

  @ApiProperty({ description: 'One-line AI summary' })
  @Column({ type: 'text', nullable: true })
  summary: string;

  @ApiPropertyOptional({
    description: 'Owning project id (null = not filed under a project)',
    nullable: true,
  })
  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  // Owning side of the relation. Deleting the project nulls this FK rather than
  // deleting the entry (entries can live without a project).
  @ManyToOne(() => Project, (project) => project.knowledge, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'projectId' })
  project?: Project;

  // --- English-journey fields (only meaningful when type === ENGLISH) ---

  @ApiPropertyOptional({
    enum: CefrLevel,
    nullable: true,
    description: 'AI-graded CEFR difficulty of an English sentence',
  })
  @Column({ type: 'enum', enum: CefrLevel, nullable: true })
  cefrLevel: CefrLevel | null;

  @ApiProperty({ description: 'Times this card has been reviewed' })
  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @ApiProperty({ description: 'Times this card was marked remembered' })
  @Column({ type: 'int', default: 0 })
  correctCount: number;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'datetime', nullable: true })
  lastReviewedAt: Date | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
