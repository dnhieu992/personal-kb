import { Global, Module } from '@nestjs/common';
import { AiGateway } from './ai.gateway';

@Global()
@Module({ providers: [AiGateway], exports: [AiGateway] })
export class AiModule {}
