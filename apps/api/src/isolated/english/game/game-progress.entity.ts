import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Saved progress of one English game (levels, stars, mistakes, streak), so it
 * follows the user across browsers. Single-user app: one row per game key.
 * The blob shape belongs to the frontend (`app/english/games/progress.ts`).
 */
@Entity('english_game_progress')
export class GameProgress {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'mediumtext' })
  data: string;

  /** Set from the app clock (see diary-entry.entity.ts for why not a DB default). */
  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}
