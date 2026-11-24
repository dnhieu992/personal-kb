import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { EnglishModule } from '../english/english.module';
import { CourseGeneratorService } from './course-generator.service';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { CourseAttempt } from './entities/course-attempt.entity';
import { CourseGoal } from './entities/course-goal.entity';
import { CourseExerciseStat } from './entities/course-exercise-stat.entity';
import { CourseReviewService } from './course-review.service';
import { CourseLesson } from './entities/course-lesson.entity';
import { CoursePlacement } from './entities/course-placement.entity';
import { CourseUnit } from './entities/course-unit.entity';
import { CourseListening } from './entities/course-listening.entity';
import { ListeningService } from './listening.service';
import { CourseSyllabusService } from './course-syllabus.service';
import { PlacementService } from './placement.service';

/** "English for IT": an AI-written, stored course with lessons, practice and progress. */
@Module({
  imports: [
    TypeOrmModule.forFeature([CourseUnit, CourseLesson, CourseAttempt, CoursePlacement, CourseGoal, CourseExerciseStat, CourseListening]),
    AiModule,
    EnglishModule,
  ],
  controllers: [CourseController],
  providers: [CourseService, CourseReviewService, CourseGeneratorService, PlacementService, CourseSyllabusService, ListeningService],
})
export class CourseModule {}
