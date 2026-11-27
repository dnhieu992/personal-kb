import { Column, Entity, PrimaryColumn } from 'typeorm';

/** The My Notes passcode (single row, id = 1). Only the scrypt hash is stored. */
@Entity('diary_lock')
export class DiaryLock {
  @PrimaryColumn({ type: 'tinyint' })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  passcodeHash: string;

  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}
