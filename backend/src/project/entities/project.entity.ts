import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Knowledge } from '../../knowledge/entities/knowledge.entity';

@Entity('project')
export class Project {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Personal KB' })
  @Column({ length: 255 })
  name: string;

  @ApiPropertyOptional({ description: 'Optional free-text description' })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Inverse side of Knowledge.project — not a column. onDelete is configured on
  // the owning side (Knowledge), so deleting a project nulls its entries' projectId.
  @OneToMany(() => Knowledge, (knowledge) => knowledge.project)
  knowledge: Knowledge[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  // Populated by loadRelationCountAndMap in the list query; not persisted.
  @ApiPropertyOptional({ description: 'Number of knowledge entries in this project' })
  knowledgeCount?: number;
}
