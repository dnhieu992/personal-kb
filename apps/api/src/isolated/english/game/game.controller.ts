import { GameProgressInput } from '@pkb/contracts';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('english/games')
export class GameController {
  constructor(private readonly service: GameService) {}

  @Get('progress/:key')
  async get(@Param('key') key: string) {
    return { data: await this.service.get(key) };
  }

  @Put('progress/:key')
  save(@Param('key') key: string, @Body(new ZodPipe(GameProgressInput)) dto: GameProgressInput) {
    return this.service.save(key.slice(0, 64), dto.data);
  }
}
