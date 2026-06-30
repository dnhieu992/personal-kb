import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RecordReviewDto {
  @ApiProperty({ description: 'Whether the sentence was remembered' })
  @IsBoolean()
  remembered: boolean;
}
