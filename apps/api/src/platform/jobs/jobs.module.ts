import { Global, Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobWorker } from './job.worker';

@Global()
@Module({ providers: [JobService, JobWorker], exports: [JobService] })
export class JobsModule {}
