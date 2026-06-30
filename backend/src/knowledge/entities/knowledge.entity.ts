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

/**
 * Sub-kind of an ENGLISH entry. JOURNAL is a free-form learning-diary entry the
 * user writes; the rest are reviewable items the AI extracts from a JOURNAL.
 */
export enum EnglishKind {
  JOURNAL = 'JOURNAL',
  SENTENCE = 'SENTENCE',
  GRAMMAR = 'GRAMMAR',
  MISTAKE = 'MISTAKE',
  VOCAB = 'VOCAB',
}

/** ENGLISH kinds that are flashcard-reviewable (everything except JOURNAL). */
export const REVIEWABLE_KINDS: EnglishKind[] = [
  EnglishKind.SENTENCE,
  EnglishKind.GRAMMAR,
  EnglishKind.MISTAKE,
  EnglishKind.VOCAB,
];

/** A file stored in R2 and referenced from an entry. */
export interface ImageRef {
  key: string;
  url: string;
  name?: string;
  size?: number;
  type?: string;
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

  @ApiPropertyOptional({
    description: 'Attached images stored in R2',
    type: 'array',
    items: { type: 'object' },
  })
  @Column({ type: 'simple-json', nullable: true })
  images: ImageRef[] | null;

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
    enum: EnglishKind,
    nullable: true,
    description: 'JOURNAL diary entry, or a reviewable item extracted from one',
  })
  @Column({ type: 'enum', enum: EnglishKind, nullable: true })
  englishKind: EnglishKind | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'For an extracted item: the id of the JOURNAL entry it came from',
  })
  @Column({ type: 'uuid', nullable: true })
  sourceId: string | null;

  @ApiProperty({ description: 'AI flagged this item as hard to remember' })
  @Column({ type: 'boolean', default: false })
  hard: boolean;

  @ApiPropertyOptional({
    enum: CefrLevel,
    nullable: true,
    description: 'AI-graded CEFR difficulty of an English item',
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
