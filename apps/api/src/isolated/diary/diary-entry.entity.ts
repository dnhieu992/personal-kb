import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One private note ("My Notes"): what was written, the day it belongs to, and when. */
@Entity('diary_entry')
export class DiaryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'mediumtext' })
  content: string;

  /** Calendar day (YYYY-MM-DD in APP_TZ) the note belongs to — may be a past day. */
  @Column({ type: 'date' })
  entryDate: string;

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
