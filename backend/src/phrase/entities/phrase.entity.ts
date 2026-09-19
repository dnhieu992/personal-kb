import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** An English phrase the daily Telegram cron rotates through. */
@Entity('phrase')
export class Phrase {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'break the ice', description: 'The English phrase' })
  @Column({ length: 255 })
  phrase: string;

  @ApiProperty({ example: 'phá vỡ sự ngại ngùng ban đầu', description: 'Vietnamese meaning' })
  @Column({ type: 'text' })
  meaning: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'He told a joke to break the ice.',
    description: 'Example sentence using the phrase',
  })
  @Column({ type: 'text', nullable: true })
  example: string | null;

  @ApiProperty({
    description: 'How many times this phrase has been sent to Telegram',
    example: 0,
  })
  @Column({ type: 'int', default: 0 })
  sentCount: number;

  @ApiPropertyOptional({ nullable: true, description: 'Last time it was sent' })
  @Column({ type: 'datetime', nullable: true })
  lastSentAt: Date | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
