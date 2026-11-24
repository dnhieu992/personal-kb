import { Body, Controller, Get, Param, ParseEnumPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';
import { CourseGeneratorService } from './course-generator.service';
import { CourseService } from './course.service';
import { SetGoalDto } from './dto/goal.dto';
import { SubmitReviewDto } from './dto/review.dto';
import { CourseReviewService } from './course-review.service';
import { EfsetScoreDto, SubmitPlacementDto } from './dto/placement.dto';
import { GradeSummaryDto, GradeWritingDto, SubmitAttemptDto } from './dto/submit-attempt.dto';
import { ListeningService } from './listening.service';
import { PlacementService } from './placement.service';

@ApiTags('course')
@Controller('course')
export class CourseController {
  constructor(
    private readonly service: CourseService,
    private readonly generator: CourseGeneratorService,
    private readonly placement: PlacementService,
    private readonly review: CourseReviewService,
    private readonly listening: ListeningService,
  ) {}

  @Get('review/weak')
  @ApiOperation({ summary: 'Weak points ranked from your mistakes (and the placement test)' })
  weak() {
    return this.review.weakPoints();
  }

  @Get('review/daily')
  @ApiOperation({ summary: 'Today’s mixed review test: due mistakes + fresh items on weak points' })
  daily() {
    return this.review.daily();
  }

  @Get('review/points/:key')
  @ApiOperation({ summary: 'One weak point: common-mistake notes, your wrong answers, a short test' })
  focus(@Param('key') key: string) {
    return this.review.focus(key);
  }

  @Post('review/results')
  @ApiOperation({ summary: 'Record a review test (updates the spaced schedule)' })
  submitReview(@Body() dto: SubmitReviewDto) {
    return this.review.submit(dto.results);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Course dashboard: levels, units, lessons, progress' })
  @ApiQuery({ name: 'level', required: false, enum: CefrLevel })
  async overview(
    @Query('level', new ParseEnumPipe(CefrLevel, { optional: true })) level?: CefrLevel,
  ) {
    return this.service.overview(level ?? (await this.service.defaultLevel()));
  }

  @Get('journey')
  @ApiOperation({ summary: 'Progress from the start level to the goal level, pace and ETA' })
  journey() {
    return this.service.journey();
  }

  @Put('goal')
  @ApiOperation({ summary: 'Set the target level and weekly pace' })
  setGoal(@Body() dto: SetGoalDto) {
    return this.service.setGoal(dto);
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

  @Post('lessons/:id/grade')
  @ApiOperation({ summary: 'AI-grade the answer to one writing exercise of the lesson' })
  grade(@Param('id') id: string, @Body() dto: GradeWritingDto) {
    return this.service.gradeWriting(id, dto.index, dto.text);
  }

  @Get('lessons/:id/listening')
  @ApiOperation({ summary: 'The lesson’s listening task (null task = not written yet) and its planned length' })
  getListening(@Param('id') id: string) {
    return this.listening.get(id);
  }

  @Post('lessons/:id/listening/generate')
  @ApiOperation({ summary: 'Write (or rewrite) the lesson’s listening task with the AI (background, ~1 min)' })
  generateListening(@Param('id') id: string) {
    return this.listening.generate(id);
  }

  @Post('lessons/:id/listening/grade')
  @ApiOperation({ summary: 'AI-grade a summary of the listening passage (≥ 60% of key ideas passes)' })
  gradeListening(@Param('id') id: string, @Body() dto: GradeSummaryDto) {
    return this.listening.grade(id, dto.text, dto.questionsCorrect);
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
