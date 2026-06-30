import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

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
}
