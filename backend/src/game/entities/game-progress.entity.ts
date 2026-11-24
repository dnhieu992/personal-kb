import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Saved progress of one English game (levels, stars, mistakes, streak), so it
 * follows the user across browsers. Single-user app: one row per game key.
 * The blob shape belongs to the frontend (`app/english/games/progress.ts`).
 */
@Entity('game_progress')
export class GameProgress {
  @ApiProperty({ example: 'kb.game.sentence.v1' })
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @ApiProperty({ description: 'Progress JSON as the game stores it' })
  @Column({ type: 'mediumtext' })
  data: string;

  /** Set from the app clock (see diary-entry.entity.ts for why not a DB default). */
  @ApiProperty()
  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}
