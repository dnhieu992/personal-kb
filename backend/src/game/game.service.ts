import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameProgress } from './entities/game-progress.entity';

@Injectable()
export class GameService {
  constructor(@InjectRepository(GameProgress) private readonly repo: Repository<GameProgress>) {}

  /** The saved progress for a game, or null if it was never saved. */
  async get(key: string): Promise<Record<string, unknown> | null> {
    const row = await this.repo.findOneBy({ key });
    if (!row) return null;
    try {
      return JSON.parse(row.data);
    } catch {
      return null;
    }
  }

  async save(key: string, data: Record<string, unknown>) {
    await this.repo.save({ key, data: JSON.stringify(data), updatedAt: new Date() });
    return { ok: true };
  }
}
