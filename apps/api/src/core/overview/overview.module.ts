import { Module } from '@nestjs/common';
import { NoteModule } from '../note';
import { ProjectModule } from '../project';
import { TaskModule } from '../task';
import { OverviewController } from './overview.controller';

@Module({ imports: [ProjectModule, TaskModule, NoteModule], controllers: [OverviewController] })
export class OverviewModule {}
