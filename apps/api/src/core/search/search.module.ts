import { Module } from '@nestjs/common';
import { NoteModule } from '../note';
import { ProjectModule } from '../project';
import { TaskModule } from '../task';
import { SearchController } from './search.controller';
import { AskService } from './ask.service';
import { SearchService } from './search.service';

@Module({
  imports: [NoteModule, TaskModule, ProjectModule],
  controllers: [SearchController],
  providers: [SearchService, AskService],
})
export class SearchModule {}
