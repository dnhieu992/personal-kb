import { Body, Controller, Get, Param, ParseEnumPipe, Post, Put, Query } from '@nestjs/common';
import { CefrLevel } from '../shared/cefr';
import {
  EfsetScoreInput,
  GradeSummaryInput,
  GradeWritingInput,
  SetGoalInput,
  SubmitAttemptInput,
  SubmitPlacementInput,
  SubmitReviewInput,
} from '@pkb/contracts';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { CourseGeneratorService } from './course-generator.service';
import { CourseService } from './course.service';
import { CourseReviewService } from './course-review.service';
import { ListeningService } from './listening.service';
import { PlacementService } from './placement.service';

@Controller('english/course')
export class CourseController {
  constructor(
    private readonly service: CourseService,
    private readonly generator: CourseGeneratorService,
    private readonly placement: PlacementService,
    private readonly review: CourseReviewService,
    private readonly listening: ListeningService,
  ) {}

  @Get('review/weak')
  weak() {
    return this.review.weakPoints();
  }

  @Get('review/daily')
  daily() {
    return this.review.daily();
  }

  @Get('review/points/:key')
  focus(@Param('key') key: string) {
    return this.review.focus(key);
  }

  @Post('review/results')
  submitReview(@Body(new ZodPipe(SubmitReviewInput)) dto: SubmitReviewInput) {
    return this.review.submit(dto.results);
  }

  @Get('overview')
  async overview(
    @Query('level', new ParseEnumPipe(CefrLevel, { optional: true })) level?: CefrLevel,
  ) {
    return this.service.overview(level ?? (await this.service.defaultLevel()));
  }

  @Get('journey')
  journey() {
    return this.service.journey();
  }

  @Put('goal')
  setGoal(@Body(new ZodPipe(SetGoalInput)) dto: SetGoalInput) {
    return this.service.setGoal(dto);
  }

  @Get('placement')
  latestPlacement() {
    return this.placement.latest();
  }

  @Get('placement/test')
  placementTest() {
    return this.placement.test();
  }

  @Post('placement/blocks/:level')
  checkBlock(
    @Param('level', new ParseEnumPipe(CefrLevel)) level: CefrLevel,
    @Body(new ZodPipe(SubmitPlacementInput)) dto: SubmitPlacementInput,
  ) {
    return this.placement.checkBlock(level, dto.answers);
  }

  @Post('placement')
  submitPlacement(@Body(new ZodPipe(SubmitPlacementInput)) dto: SubmitPlacementInput) {
    return this.placement.submit(dto.answers);
  }

  @Get('placement/:id/review')
  reviewPlacement(@Param('id') id: string) {
    return this.placement.review(id);
  }

  @Post('placement/efset')
  efset(@Body(new ZodPipe(EfsetScoreInput)) dto: EfsetScoreInput) {
    return this.placement.setEfset(dto.score);
  }

  @Get('lessons/:id')
  lesson(@Param('id') id: string) {
    return this.service.lesson(id);
  }

  @Post('lessons/:id/attempts')
  submit(@Param('id') id: string, @Body(new ZodPipe(SubmitAttemptInput)) dto: SubmitAttemptInput) {
    return this.service.submitAttempt(id, dto);
  }

  @Post('lessons/:id/grade')
  grade(@Param('id') id: string, @Body(new ZodPipe(GradeWritingInput)) dto: GradeWritingInput) {
    return this.service.gradeWriting(id, dto.index, dto.text);
  }

  @Get('lessons/:id/listening')
  getListening(@Param('id') id: string) {
    return this.listening.get(id);
  }

  @Post('lessons/:id/listening/generate')
  generateListening(@Param('id') id: string) {
    return this.listening.generate(id);
  }

  @Post('lessons/:id/listening/grade')
  gradeListening(@Param('id') id: string, @Body(new ZodPipe(GradeSummaryInput)) dto: GradeSummaryInput) {
    return this.listening.grade(id, dto.text, dto.questionsCorrect);
  }

  @Post('lessons/:id/regenerate')
  regenerate(@Param('id') id: string) {
    return this.generator.regenerate(id);
  }

  @Post('levels/:level/generate')
  generate(@Param('level', new ParseEnumPipe(CefrLevel)) level: CefrLevel) {
    return this.generator.start(level);
  }
}
