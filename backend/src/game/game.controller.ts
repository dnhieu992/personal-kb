import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameProgressDto } from './dto/game-progress.dto';
import { GameService } from './game.service';

@ApiTags('games')
@Controller('games')
export class GameController {
  constructor(private readonly service: GameService) {}

  @Get('progress/:key')
  @ApiOperation({ summary: "A game's saved progress ({ data: null } if none yet)" })
  async get(@Param('key') key: string) {
    return { data: await this.service.get(key) };
  }

  @Put('progress/:key')
  @ApiOperation({ summary: "Save a game's progress (replaces the stored copy)" })
  save(@Param('key') key: string, @Body() dto: GameProgressDto) {
    return this.service.save(key.slice(0, 64), dto.data);
  }
}
