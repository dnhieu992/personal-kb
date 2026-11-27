import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller';
import { UserProfile } from './user-profile.entity';

@Module({ imports: [TypeOrmModule.forFeature([UserProfile])], controllers: [ProfileController] })
export class ProfileModule {}
