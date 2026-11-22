import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One technical note: what was written and when. */
@Entity('tech_note')
export class TechNote {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: '## Kafka consumer lag\nNguyên nhân: …' })
  @Column({ type: 'mediumtext' })
  content: string;

  /*
   * Both stamps are set by TechNoteService from the app clock, not by a MySQL
   * DEFAULT: the VPS MySQL runs on +07 while the container reads DATETIMEs as
   * UTC, so CURRENT_TIMESTAMP would come back 7 hours ahead.
   */
  @ApiProperty({ description: 'When it was written' })
  @Index()
  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;

  @ApiProperty()
  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}
