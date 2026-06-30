import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { KnowledgeType } from '../entities/knowledge.entity';
import { ImageRefDto } from './image-ref.dto';

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

  @ApiPropertyOptional({
    description:
      'Project this entry belongs to. Omit to leave unchanged, or send null to unfile.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.projectId !== null)
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional({
    type: [ImageRefDto],
    description: 'Images already uploaded via POST /uploads/images',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageRefDto)
  images?: ImageRefDto[];
}
