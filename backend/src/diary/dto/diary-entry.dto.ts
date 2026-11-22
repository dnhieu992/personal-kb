import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DiaryEntryDto {
  @ApiProperty({ example: 'Hôm nay deploy xong tính năng diary.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  content: string;
}
