import { Global, Module } from '@nestjs/common';
import { Embedder } from './embedder';
import { VectorStore } from './vector.store';

@Global()
@Module({ providers: [Embedder, VectorStore], exports: [Embedder, VectorStore] })
export class VectorModule {}
