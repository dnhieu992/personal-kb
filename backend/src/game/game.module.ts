import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameProgress } from './entities/game-progress.entity';
import { GameController } from './game.controller';
import { GameService } from './game.service';

/** Saved progress for the English games (/english/games), shared across browsers. */
@Module({
  imports: [TypeOrmModule.forFeature([GameProgress])],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
