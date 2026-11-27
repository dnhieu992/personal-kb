import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from '../../platform/auth/password';
import { ENV, Env } from '../../platform/config/config';
import { DiaryLock } from './diary-lock.entity';
import { signUnlock, UNLOCK_TTL_MS, verifyUnlock } from './notes-lock';

@Injectable()
export class NotesLockService {
  constructor(@InjectRepository(DiaryLock) private readonly repo: Repository<DiaryLock>, @Inject(ENV) private readonly env: Env) {}

  private row() {
    return this.repo.findOne({ where: { id: 1 } });
  }

  async state() {
    return { configured: !!(await this.row()) };
  }

  private issue(hash: string) {
    const exp = Date.now() + UNLOCK_TTL_MS;
    return { token: signUnlock(exp, this.env.SESSION_SECRET, hash), expiresAt: new Date(exp).toISOString() };
  }

  /** First-time setup; refuses once a passcode exists (change it with the current one instead). */
  async setup(passcode: string) {
    if (await this.row()) throw new ConflictException('A passcode is already set');
    const hash = await hashPassword(passcode);
    await this.repo.save(this.repo.create({ id: 1, passcodeHash: hash, updatedAt: new Date() }));
    return this.issue(hash);
  }

  async unlock(passcode: string) {
    const row = await this.row();
    if (!row) throw new BadRequestException('Set a passcode first');
    // 403, not 401: a 401 would send the browser to the login page.
    if (!(await verifyPassword(passcode, row.passcodeHash))) throw new ForbiddenException('Wrong passcode');
    return this.issue(row.passcodeHash);
  }

  async change(current: string, next: string) {
    const row = await this.row();
    if (!row) throw new BadRequestException('Set a passcode first');
    if (!(await verifyPassword(current, row.passcodeHash))) throw new ForbiddenException('Wrong passcode');
    row.passcodeHash = await hashPassword(next);
    row.updatedAt = new Date();
    await this.repo.save(row);
    return this.issue(row.passcodeHash);
  }

  async check(token: string | undefined) {
    const row = await this.row();
    if (!row || !verifyUnlock(token, this.env.SESSION_SECRET, row.passcodeHash)) throw new ForbiddenException('My Notes is locked');
  }
}
