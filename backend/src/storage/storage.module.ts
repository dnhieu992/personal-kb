import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { UploadController } from './upload.controller';

// Global so any feature module can inject StorageService without re-importing.
@Global()
@Module({
  providers: [StorageService],
  controllers: [UploadController],
  exports: [StorageService],
})
export class StorageModule {}
