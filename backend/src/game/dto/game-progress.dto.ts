import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class GameProgressDto {
  @ApiProperty({ description: 'Progress JSON as the game stores it' })
  @IsObject()
  data: Record<string, unknown>;
}
