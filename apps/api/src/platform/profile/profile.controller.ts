import { Body, Controller, Get, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile, UpdateProfileInput } from '@pkb/contracts';
import { Repository } from 'typeorm';
import { ZodPipe } from '../http/zod.pipe';
import { UserProfile } from './user-profile.entity';

const avatarUrl = (key: string | null) => (key ? `/api/uploads/images/${Buffer.from(key).toString('base64url')}` : null);

function toDto(p: UserProfile | null): Profile {
  return {
    displayName: p?.displayName ?? 'Me',
    email: p?.email ?? null,
    bio: p?.bio ?? null,
    avatarKey: p?.avatarKey ?? null,
    avatarUrl: avatarUrl(p?.avatarKey ?? null),
  };
}

@Controller('profile')
export class ProfileController {
  constructor(@InjectRepository(UserProfile) private readonly repo: Repository<UserProfile>) {}

  @Get()
  async get(): Promise<Profile> {
    return toDto(await this.repo.findOne({ where: { id: 1 } }));
  }

  @Put()
  async update(@Body(new ZodPipe(UpdateProfileInput)) dto: UpdateProfileInput): Promise<Profile> {
    return toDto(await this.repo.save(this.repo.create({ id: 1, ...dto, updatedAt: new Date() })));
  }
}
