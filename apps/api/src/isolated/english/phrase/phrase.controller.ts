import { CreatePhraseInput, UpdatePhraseInput } from '@pkb/contracts';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PhraseCronService } from './phrase-cron.service';
import { PhraseService } from './phrase.service';

@Controller('english/phrases')
export class PhraseController {
  constructor(
    private readonly service: PhraseService,
    private readonly cron: PhraseCronService,
  ) {}

  @Post()
  create(@Body(new ZodPipe(CreatePhraseInput)) dto: CreatePhraseInput) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post('send-now')
  async sendNow() {
    const sent = await this.cron.sendDailyBatch();
    return { sent: sent.length, phrases: sent };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodPipe(UpdatePhraseInput)) dto: UpdatePhraseInput) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
