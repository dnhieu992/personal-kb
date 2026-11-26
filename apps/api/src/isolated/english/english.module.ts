import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardService } from './card/card.service';
import { EnglishController } from './card/english.controller';
import { EnglishCardEntity } from './card/english-card.entity';
import { EnglishJournalEntity } from './card/english-journal.entity';
import { CheckService } from './check/check.service';
import { EnglishCorrectionEntity } from './correction/english-correction.entity';
import { CourseAiService } from './course/course-ai.service';
import { CourseGeneratorService } from './course/course-generator.service';
import { CourseReviewService } from './course/course-review.service';
import { CourseSyllabusService } from './course/course-syllabus.service';
import { CourseController } from './course/course.controller';
import { CourseService } from './course/course.service';
import { CourseAttempt } from './course/entities/course-attempt.entity';
import { CourseExerciseStat } from './course/entities/course-exercise-stat.entity';
import { CourseGoal } from './course/entities/course-goal.entity';
import { CourseLesson } from './course/entities/course-lesson.entity';
import { CourseListening } from './course/entities/course-listening.entity';
import { CoursePlacement } from './course/entities/course-placement.entity';
import { CourseUnit } from './course/entities/course-unit.entity';
import { ListeningService } from './course/listening.service';
import { PlacementService } from './course/placement.service';
import { GameProgress } from './game/game-progress.entity';
import { GameController } from './game/game.controller';
import { GameService } from './game/game.service';
import { PhraseCronService } from './phrase/phrase-cron.service';
import { PhraseController } from './phrase/phrase.controller';
import { Phrase } from './phrase/phrase.entity';
import { PhraseService } from './phrase/phrase.service';
import { TelegramService } from './phrase/telegram.service';
import { TtsController } from './tts/tts.controller';
import { TtsService } from './tts/tts.service';

/**
 * ISOLATED module (SPEC §7.1): tables `english_*`, routes `/api/english/*`, depends only on
 * platform/ (auth, AiGateway, storage, config). It never reads or writes task/note tables —
 * core editors reach it one way, over HTTP (`POST /english/check`, `POST /english/mistakes`).
 * Lifting it into its own app = move this folder + the english_* tables.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnglishCardEntity,
      EnglishJournalEntity,
      EnglishCorrectionEntity,
      CourseUnit,
      CourseLesson,
      CourseAttempt,
      CourseGoal,
      CourseExerciseStat,
      CoursePlacement,
      CourseListening,
      Phrase,
      GameProgress,
    ]),
  ],
  controllers: [EnglishController, CourseController, PhraseController, GameController, TtsController],
  providers: [
    CardService,
    CheckService,
    CourseAiService,
    CourseService,
    CourseGeneratorService,
    CourseReviewService,
    CourseSyllabusService,
    ListeningService,
    PlacementService,
    PhraseService,
    PhraseCronService,
    TelegramService,
    GameService,
    TtsService,
  ],
})
export class EnglishModule {}
