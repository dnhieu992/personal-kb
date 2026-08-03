import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SuggestTagsDto {
  @ApiProperty({ description: 'Pasted content to extract tags from' })
  @IsString()
  content: string;
}

export class FormatContentDto {
  @ApiProperty({ description: 'Raw entry body to reformat as Markdown' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Entry title, used as context only' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Entry type, used as context only' })
  @IsOptional()
  @IsString()
  type?: string;
}

export class ChatDto {
  @ApiProperty({ example: 'How did we fix the N+1 query problem?' })
  @IsString()
  question: string;
}
