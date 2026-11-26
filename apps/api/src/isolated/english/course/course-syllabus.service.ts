import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CefrLevel } from '../shared/cefr';
import { CourseLesson, LessonStatus } from './entities/course-lesson.entity';
import { CourseUnit } from './entities/course-unit.entity';
import { B1_GAP_UNIT, LEGACY_KEYS } from './syllabus-backfill';

/**
 * Ties lessons written before the syllabus existed to it (once, on boot):
 * maps their grammar labels to Core Inventory keys and adds the B1 unit that
 * covers the points the first B1 outline missed.
 */
@Injectable()
export class CourseSyllabusService implements OnModuleInit {
  private readonly logger = new Logger(CourseSyllabusService.name);

  constructor(
    @InjectRepository(CourseUnit) private readonly units: Repository<CourseUnit>,
    @InjectRepository(CourseLesson) private readonly lessons: Repository<CourseLesson>,
  ) {}

  async onModuleInit() {
    try {
      await this.mapLegacy();
      await this.addB1Gaps();
    } catch (e) {
      this.logger.error(`syllabus backfill failed: ${(e as Error).message}`);
    }
  }

  private async mapLegacy() {
    const rows = await this.lessons.find({
      where: { syllabusKeys: IsNull() },
      select: ['id', 'grammar'],
    });
    for (const row of rows) {
      await this.lessons.update(row.id, { syllabusKeys: LEGACY_KEYS[row.grammar] ?? [] });
    }
    if (rows.length) this.logger.log(`mapped ${rows.length} lessons to the syllabus`);
  }

  private async addB1Gaps() {
    const units = await this.units.find({ where: { level: CefrLevel.B1 } });
    if (!units.length || units.some((u) => u.title === B1_GAP_UNIT.title)) return;
    const unit = await this.units.save(
      this.units.create({
        level: CefrLevel.B1,
        position: Math.max(...units.map((u) => u.position)) + 1,
        title: B1_GAP_UNIT.title,
        titleVi: B1_GAP_UNIT.titleVi,
        summary: B1_GAP_UNIT.summary,
      }),
    );
    await this.lessons.save(
      B1_GAP_UNIT.lessons.map((l, i) =>
        this.lessons.create({
          ...l,
          unitId: unit.id,
          level: CefrLevel.B1,
          position: i + 1,
          status: LessonStatus.PENDING,
        }),
      ),
    );
    this.logger.log(`B1: added unit "${unit.title}" (${B1_GAP_UNIT.lessons.length} lessons to write)`);
  }
}
