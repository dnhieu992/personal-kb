import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ImageRefDto } from './image-ref.dto';

export class CreateJournalDto {
  @ApiProperty({
    example:
      'Hôm nay học được mẫu câu "I should have left earlier", thấy khá khó nhớ.',
    description: 'Free-form English-learning diary entry (any language).',
  })
  @IsString()
  text: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.projectId !== null)
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional({ type: [ImageRefDto], description: 'Attached images' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageRefDto)
  images?: ImageRefDto[];
}
