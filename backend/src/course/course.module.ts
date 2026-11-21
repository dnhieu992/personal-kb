import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { EnglishModule } from '../english/english.module';
import { CourseGeneratorService } from './course-generator.service';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { CourseAttempt } from './entities/course-attempt.entity';
import { CourseLesson } from './entities/course-lesson.entity';
import { CourseUnit } from './entities/course-unit.entity';

/** "English for IT": an AI-written, stored course with lessons, practice and progress. */
@Module({
  imports: [
    TypeOrmModule.forFeature([CourseUnit, CourseLesson, CourseAttempt]),
    AiModule,
    EnglishModule,
  ],
  controllers: [CourseController],
  providers: [CourseService, CourseGeneratorService],
})
export class CourseModule {}
