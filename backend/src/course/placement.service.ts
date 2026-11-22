import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';
import { COURSE_LEVELS } from './course.types';
import {
  CoursePlacement,
  PlacementLevelScore,
  PlacementSkillScore,
} from './entities/course-placement.entity';
import {
  PLACEMENT_ITEMS,
  PLACEMENT_LEVELS,
  PLACEMENT_PASS,
  PLACEMENT_STOP,
  PlacementSkill,
} from './placement-bank';
import { efsetToCefr, syllabusPoint } from './syllabus';

const SKILLS: PlacementSkill[] = ['grammar', 'vocab', 'reading', 'listening'];

/** Course levels only go A2–C1: clamp anything outside. */
function toCourseLevel(level: CefrLevel): CefrLevel {
  if (level === CefrLevel.A1) return CefrLevel.A2;
  if (level === CefrLevel.C2) return CefrLevel.C1;
  return COURSE_LEVELS.includes(level) ? level : CefrLevel.B1;
}

/**
 * The placement test: a block of items per level, easiest first. The client
 * stops after a block scored under PLACEMENT_STOP; the learner is placed at the
 * first level they did not pass (≥ PLACEMENT_PASS). Grammar items are tagged with
 * syllabus keys, so the result also says which lessons' points are already
 * mastered and which are weak.
 */
@Injectable()
export class PlacementService {
  constructor(
    @InjectRepository(CoursePlacement) private readonly repo: Repository<CoursePlacement>,
  ) {}

  /** The test as the browser sees it: no answers. */
  test() {
    return {
      levels: PLACEMENT_LEVELS,
      passShare: PLACEMENT_PASS,
      stopShare: PLACEMENT_STOP,
      items: PLACEMENT_ITEMS.map(({ answer: _answer, ...item }) => item),
    };
  }

  /** Score one level's block so the client can decide whether to go on. */
  checkBlock(level: CefrLevel, answers: Record<string, string>) {
    const items = PLACEMENT_ITEMS.filter((i) => i.level === level);
    if (!items.length) throw new BadRequestException(`No placement block for ${level}`);
    const correct = items.filter((i) => answers?.[i.id] === i.answer).length;
    const share = correct / items.length;
    return {
      level,
      correct,
      total: items.length,
      passed: share >= PLACEMENT_PASS,
      next: share >= PLACEMENT_STOP,
    };
  }

  async submit(answers: Record<string, string>) {
    const levels: PlacementLevelScore[] = [];
    const skills = new Map<string, PlacementSkillScore>(
      SKILLS.map((s) => [s, { skill: s, correct: 0, total: 0 }]),
    );
    const mastered: string[] = [];
    const missed: { key: string; level: CefrLevel }[] = [];
    const kept: Record<string, string> = {};
    let stopped = false;
    let placed: CefrLevel | null = null;

    for (const level of PLACEMENT_LEVELS) {
      const items = PLACEMENT_ITEMS.filter((i) => i.level === level);
      if (stopped) {
        levels.push({ level, correct: 0, total: items.length, taken: false });
        continue;
      }
      let correct = 0;
      for (const item of items) {
        const chosen = answers[item.id];
        if (chosen !== undefined) kept[item.id] = chosen;
        const ok = chosen === item.answer;
        if (ok) correct += 1;
        const s = skills.get(item.skill)!;
        s.total += 1;
        if (ok) s.correct += 1;
        if (item.key && ok) mastered.push(item.key);
        if (item.key && !ok) missed.push({ key: item.key, level });
      }
      levels.push({ level, correct, total: items.length, taken: true });
      const share = correct / items.length;
      if (!placed && share < PLACEMENT_PASS) placed = level;
      if (share < PLACEMENT_STOP) stopped = true;
    }

    const placedLevel = placed ?? PLACEMENT_LEVELS[PLACEMENT_LEVELS.length - 1];
    // Missing a point above your level is expected, not a weakness to fix first.
    const placedIdx = PLACEMENT_LEVELS.indexOf(placedLevel);
    const weak = missed
      .filter((m) => PLACEMENT_LEVELS.indexOf(m.level) <= placedIdx)
      .map((m) => m.key);
    const previous = await this.latestRow();
    const taken = levels.filter((l) => l.taken);
    const totalTaken = taken.reduce((n, l) => n + l.total, 0);
    const correctTaken = taken.reduce((n, l) => n + l.correct, 0);
    const row = await this.repo.save(
      this.repo.create({
        placedLevel,
        score: totalTaken ? Math.round((correctTaken / totalTaken) * 100) : 0,
        levels,
        skills: [...skills.values()],
        mastered,
        weak,
        answers: kept,
        efsetScore: previous?.efsetScore ?? null,
      }),
    );
    return this.present(row);
  }

  /**
   * Record an EF SET score. It is shown next to the in-app result; with no
   * in-app test yet it becomes the placement on its own.
   */
  async setEfset(score: number) {
    const latest = await this.latestRow();
    if (latest) {
      latest.efsetScore = score;
      return this.present(await this.repo.save(latest));
    }
    const row = await this.repo.save(
      this.repo.create({
        placedLevel: toCourseLevel(efsetToCefr(score)),
        score: 0,
        levels: [],
        skills: [],
        mastered: [],
        weak: [],
        answers: {},
        efsetScore: score,
      }),
    );
    return this.present(row);
  }

  async latest() {
    const row = await this.latestRow();
    return row ? this.present(row) : null;
  }

  /** With the answer key, for reviewing a finished test. */
  async review(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) return null;
    return PLACEMENT_ITEMS.filter((i) => i.id in row.answers).map((i) => ({
      ...i,
      chosen: row.answers[i.id],
      correct: row.answers[i.id] === i.answer,
    }));
  }

  private latestRow() {
    return this.repo.findOne({ where: {}, order: { createdAt: 'DESC' } });
  }

  private present(row: CoursePlacement) {
    const efsetLevel = row.efsetScore === null ? null : efsetToCefr(row.efsetScore);
    const points = (keys: string[]) =>
      keys.map((k) => syllabusPoint(k)).filter((p): p is NonNullable<typeof p> => !!p);
    return {
      ...row,
      efsetLevel,
      inAppTaken: row.levels.length > 0,
      masteredPoints: points(row.mastered),
      weakPoints: points(row.weak),
    };
  }
}
