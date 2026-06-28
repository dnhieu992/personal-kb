import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SuggestTagsDto {
  @ApiProperty({ description: 'Pasted content to extract tags from' })
  @IsString()
  content: string;
}

export class ChatDto {
  @ApiProperty({ example: 'How did we fix the N+1 query problem?' })
  @IsString()
  question: string;
}
