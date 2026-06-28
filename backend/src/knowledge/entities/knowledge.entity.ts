import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum KnowledgeType {
  BUG_FIX = 'BUG_FIX',
  HOW_TO = 'HOW_TO',
  ARCHITECTURE = 'ARCHITECTURE',
  INSIGHT = 'INSIGHT',
  DAILY_LOG = 'DAILY_LOG',
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

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
