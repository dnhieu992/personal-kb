import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One diary note: what was written and when. */
@Entity('diary_entry')
export class DiaryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'mediumtext' })
  content: string;

  /*
   * Both stamps are set by DiaryService from the app clock, not by a MySQL
   * DEFAULT: the VPS MySQL runs on +07 while the container reads DATETIMEs as
   * UTC, so CURRENT_TIMESTAMP would come back 7 hours ahead.
   */
  @Index()
  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}
