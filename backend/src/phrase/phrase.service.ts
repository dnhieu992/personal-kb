import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreatePhraseDto } from './dto/create-phrase.dto';
import { UpdatePhraseDto } from './dto/update-phrase.dto';
import { Phrase } from './entities/phrase.entity';

@Injectable()
export class PhraseService {
  constructor(
    @InjectRepository(Phrase)
    private readonly repo: Repository<Phrase>,
  ) {}

  create(dto: CreatePhraseDto): Promise<Phrase> {
    return this.repo.save(
      this.repo.create({
        phrase: dto.phrase.trim().slice(0, 255),
        meaning: dto.meaning.trim(),
        example: dto.example?.trim() || null,
        active: dto.active ?? true,
      }),
    );
  }

  /** All phrases, oldest first so the table numbering (#) is stable. */
  findAll(): Promise<Phrase[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Phrase> {
    const phrase = await this.repo.findOne({ where: { id } });
    if (!phrase) throw new NotFoundException(`Phrase ${id} not found`);
    return phrase;
  }

  async update(id: string, dto: UpdatePhraseDto): Promise<Phrase> {
    const phrase = await this.findOne(id);
    Object.assign(phrase, {
      phrase: dto.phrase?.trim().slice(0, 255) || phrase.phrase,
      meaning: dto.meaning?.trim() || phrase.meaning,
      example: dto.example === undefined ? phrase.example : dto.example?.trim() || null,
      active: dto.active === undefined ? phrase.active : dto.active,
    });
    return this.repo.save(phrase);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const phrase = await this.findOne(id);
    await this.repo.remove(phrase);
    return { deleted: true };
  }

  /**
   * The next `count` phrases to send: the least-sent first (ties broken by
   * oldest). Because every send increments sentCount, this walks through the
   * whole set once before any phrase repeats, then naturally loops back to the
   * start — exactly the round-robin the daily cron wants.
   */
  nextBatch(count: number): Promise<Phrase[]> {
    return this.repo.find({
      where: { active: true },
      order: { sentCount: 'ASC', createdAt: 'ASC' },
      take: count,
    });
  }

  /** Mark a batch as sent: bump sentCount and stamp lastSentAt. */
  async markSent(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.repo.increment({ id: In(ids) }, 'sentCount', 1);
    await this.repo.update({ id: In(ids) }, { lastSentAt: new Date() });
  }
}
