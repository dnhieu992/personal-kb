import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { KnowledgeType } from './entities/knowledge.entity';
import { KnowledgeService } from './knowledge.service';

@ApiTags('knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Post()
  @ApiOperation({ summary: 'Create an entry (auto tags/summary/snippets + embed)' })
  create(@Body() dto: CreateKnowledgeDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List entries, optionally filtered by type and tag' })
  @ApiQuery({ name: 'type', enum: KnowledgeType, required: false })
  @ApiQuery({ name: 'tag', required: false })
  findAll(
    @Query('type') type?: KnowledgeType,
    @Query('tag') tag?: string,
  ) {
    return this.service.findAll(type, tag);
  }

  // Declared before :id so "/search" and "/stats" are not matched as an id.
  @Get('search')
  @ApiOperation({ summary: 'Semantic search via Qdrant' })
  @ApiQuery({ name: 'q', required: true })
  search(@Query('q') q: string) {
    return this.service.search(q ?? '');
  }

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard stats (totals, today, popular tags, recent)' })
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single entry' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an entry (re-enrich + re-embed)' })
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an entry (+ remove from Qdrant)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
