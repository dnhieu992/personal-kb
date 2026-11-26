import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiaryEntry } from './diary-entry.entity';

function clean(content: string) {
  const text = content.trim();
  if (!text) throw new BadRequestException('Diary entry is empty');
  return text;
}

@Injectable()
export class DiaryService {
  constructor(@InjectRepository(DiaryEntry) private readonly repo: Repository<DiaryEntry>) {}

  /** Newest first. */
  list() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  create(content: string) {
    const now = new Date();
    return this.repo.save(this.repo.create({ content: clean(content), createdAt: now, updatedAt: now }));
  }

  async update(id: string, content: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Diary entry not found');
    row.content = clean(content);
    row.updatedAt = new Date();
    return this.repo.save(row);
  }

  async remove(id: string) {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Diary entry not found');
    return { deleted: true };
  }
}
