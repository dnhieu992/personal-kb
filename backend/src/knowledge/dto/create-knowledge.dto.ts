import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { KnowledgeType } from '../entities/knowledge.entity';

export class CreateKnowledgeDto {
  @ApiProperty({ example: 'Fixing the N+1 query in the orders endpoint' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'We were loading each order...' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: KnowledgeType })
  @IsOptional()
  @IsEnum(KnowledgeType)
  type?: KnowledgeType;

  @ApiPropertyOptional({
    type: [String],
    description: 'Leave empty to let the AI auto-extract tags',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
