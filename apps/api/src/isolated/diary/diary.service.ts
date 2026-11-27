import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { todayKey } from '@pkb/contracts';
import { Repository } from 'typeorm';
import { ENV, Env } from '../../platform/config/config';
import { DiaryEntry } from './diary-entry.entity';

function clean(content: string) {
  const text = content.trim();
  if (!text) throw new BadRequestException('Note is empty');
  return text;
}

@Injectable()
export class DiaryService {
  constructor(@InjectRepository(DiaryEntry) private readonly repo: Repository<DiaryEntry>, @Inject(ENV) private readonly env: Env) {}

  private day(entryDate: string | undefined) {
    const today = todayKey(this.env.APP_TZ);
    if (entryDate && entryDate > today) throw new BadRequestException('A note cannot belong to a future day');
    return entryDate ?? today;
  }

  /** Newest day first; within a day, newest first. */
  list() {
    return this.repo.find({ order: { entryDate: 'DESC', createdAt: 'DESC' } });
  }

  create(content: string, entryDate?: string) {
    const now = new Date();
    return this.repo.save(this.repo.create({ content: clean(content), entryDate: this.day(entryDate), createdAt: now, updatedAt: now }));
  }

  async update(id: string, content: string, entryDate?: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Note not found');
    row.content = clean(content);
    if (entryDate) row.entryDate = this.day(entryDate);
    row.updatedAt = new Date();
    return this.repo.save(row);
  }

  async remove(id: string) {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Note not found');
    return { deleted: true };
  }
}
