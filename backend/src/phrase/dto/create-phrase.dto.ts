import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreatePhraseDto {
  @ApiProperty({ example: 'break the ice' })
  @IsString()
  @MaxLength(255)
  phrase: string;

  @ApiProperty({ example: 'phá vỡ sự ngại ngùng ban đầu' })
  @IsString()
  meaning: string;

  @ApiPropertyOptional({ example: 'He told a joke to break the ice.', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.example !== null)
  @IsString()
  example?: string | null;

  @ApiPropertyOptional({
    default: true,
    description: 'false = stop sending this phrase in the daily Telegram batch',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
