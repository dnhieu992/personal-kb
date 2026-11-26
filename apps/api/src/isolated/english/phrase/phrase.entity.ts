import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** An English phrase the daily Telegram cron rotates through. */
@Entity('english_phrase')
export class Phrase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  phrase: string;

  @Column({ type: 'text' })
  meaning: string;

  @Column({ type: 'text', nullable: true })
  example: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  sentCount: number;

  @Column({ type: 'datetime', nullable: true })
  lastSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
