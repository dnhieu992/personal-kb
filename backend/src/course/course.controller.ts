import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';
import { CourseGeneratorService } from './course-generator.service';
import { CourseService } from './course.service';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

@ApiTags('course')
@Controller('course')
export class CourseController {
  constructor(
    private readonly service: CourseService,
    private readonly generator: CourseGeneratorService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Course dashboard: levels, units, lessons, progress' })
  @ApiQuery({ name: 'level', required: false, enum: CefrLevel })
  overview(
    @Query('level', new ParseEnumPipe(CefrLevel, { optional: true })) level?: CefrLevel,
  ) {
    return this.service.overview(level ?? CefrLevel.B1);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'One lesson with its content, position and lock state' })
  lesson(@Param('id') id: string) {
    return this.service.lesson(id);
  }

  @Post('lessons/:id/attempts')
  @ApiOperation({ summary: 'Record a practice run (passing completes the lesson)' })
  submit(@Param('id') id: string, @Body() dto: SubmitAttemptDto) {
    return this.service.submitAttempt(id, dto);
  }

  @Post('lessons/:id/regenerate')
  @ApiOperation({ summary: 'Rewrite one lesson with the AI (background)' })
  regenerate(@Param('id') id: string) {
    return this.generator.regenerate(id);
  }

  @Post('levels/:level/generate')
  @ApiOperation({ summary: 'Generate (or resume) a level’s content in the background' })
  generate(@Param('level', new ParseEnumPipe(CefrLevel)) level: CefrLevel) {
    return this.generator.start(level);
  }
}
