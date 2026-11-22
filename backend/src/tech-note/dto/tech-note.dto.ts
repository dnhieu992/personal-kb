import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TechNoteDto {
  @ApiProperty({ example: '## Kafka consumer lag\nNguyên nhân: …' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  content: string;
}
