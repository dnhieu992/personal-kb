import { Global, Module } from '@nestjs/common';
import { ENV, Env } from '../config/config';
import { LocalAdapter } from './local.adapter';
import { ImageUploadController } from './image-upload.controller';
import { LocalStorageController } from './local-storage.controller';
import { R2Adapter } from './r2.adapter';
import { STORAGE } from './storage.port';

@Global()
@Module({
  controllers: [LocalStorageController, ImageUploadController],
  providers: [
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: Env) => (env.STORAGE_DRIVER === 'r2' ? new R2Adapter(env) : new LocalAdapter(env)),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
