import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePhraseDto } from './dto/create-phrase.dto';
import { UpdatePhraseDto } from './dto/update-phrase.dto';
import { PhraseCronService } from './phrase-cron.service';
import { PhraseService } from './phrase.service';

@ApiTags('phrases')
@Controller('phrases')
export class PhraseController {
  constructor(
    private readonly service: PhraseService,
    private readonly cron: PhraseCronService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add an English phrase' })
  create(@Body() dto: CreatePhraseDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all phrases (oldest first)' })
  findAll() {
    return this.service.findAll();
  }

  @Post('send-now')
  @ApiOperation({ summary: 'Send today’s batch immediately (same as the cron)' })
  async sendNow() {
    const sent = await this.cron.sendDailyBatch();
    return { sent: sent.length, phrases: sent };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single phrase' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a phrase' })
  update(@Param('id') id: string, @Body() dto: UpdatePhraseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a phrase' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
