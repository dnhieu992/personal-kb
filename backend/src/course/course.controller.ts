import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';
import { CourseGeneratorService } from './course-generator.service';
import { CourseService } from './course.service';
import { EfsetScoreDto, SubmitPlacementDto } from './dto/placement.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { PlacementService } from './placement.service';

@ApiTags('course')
@Controller('course')
export class CourseController {
  constructor(
    private readonly service: CourseService,
    private readonly generator: CourseGeneratorService,
    private readonly placement: PlacementService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Course dashboard: levels, units, lessons, progress' })
  @ApiQuery({ name: 'level', required: false, enum: CefrLevel })
  async overview(
    @Query('level', new ParseEnumPipe(CefrLevel, { optional: true })) level?: CefrLevel,
  ) {
    return this.service.overview(level ?? (await this.service.defaultLevel()));
  }

  @Get('placement')
  @ApiOperation({ summary: 'Latest placement result (null before the first test)' })
  latestPlacement() {
    return this.placement.latest();
  }

  @Get('placement/test')
  @ApiOperation({ summary: 'Placement test items, by level, without answers' })
  placementTest() {
    return this.placement.test();
  }

  @Post('placement/blocks/:level')
  @ApiOperation({ summary: 'Score one level block (decides whether the test goes on)' })
  checkBlock(
    @Param('level', new ParseEnumPipe(CefrLevel)) level: CefrLevel,
    @Body() dto: SubmitPlacementDto,
  ) {
    return this.placement.checkBlock(level, dto.answers);
  }

  @Post('placement')
  @ApiOperation({ summary: 'Grade a finished placement test and store the result' })
  submitPlacement(@Body() dto: SubmitPlacementDto) {
    return this.placement.submit(dto.answers);
  }

  @Get('placement/:id/review')
  @ApiOperation({ summary: 'A finished test with the answer key' })
  reviewPlacement(@Param('id') id: string) {
    return this.placement.review(id);
  }

  @Post('placement/efset')
  @ApiOperation({ summary: 'Record an EF SET score (0–100) next to the placement' })
  efset(@Body() dto: EfsetScoreDto) {
    return this.placement.setEfset(dto.score);
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
