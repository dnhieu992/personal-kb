import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TechNoteDto {
  @ApiProperty({ example: '## Kafka consumer lag\nNguyên nhân: …' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  content: string;
}

export class EnglishCheckDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60_000)
  content: string;
}

export class EnglishCardDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  front: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  meaning: string;

  @ApiProperty({ enum: ['VOCAB', 'MISTAKE', 'GRAMMAR'] })
  @IsIn(['VOCAB', 'MISTAKE', 'GRAMMAR'])
  kind: 'VOCAB' | 'MISTAKE' | 'GRAMMAR';

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  example: string;
}

export class SaveCardsDto {
  @ApiProperty({ type: [EnglishCardDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => EnglishCardDto)
  cards: EnglishCardDto[];

  @ApiPropertyOptional({ nullable: true, description: 'The note the cards came from, once it is saved' })
  @IsOptional()
  @IsUUID()
  noteId?: string | null;
}
