import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { KnowledgeType } from '../knowledge/entities/knowledge.entity';
import { CreateKnowledgeDto } from '../knowledge/dto/create-knowledge.dto';

const samples: CreateKnowledgeDto[] = [
  {
    title: 'Fixing an N+1 query in the orders endpoint',
    type: KnowledgeType.BUG_FIX,
    content:
      'The /orders endpoint was issuing one query per order to load its line ' +
      'items, producing hundreds of queries per request. Fixed it with an ' +
      'eager join in TypeORM:\n\n' +
      '```ts\nthis.repo.find({ relations: { items: true } });\n```\n\n' +
      'Latency dropped from ~1.2s to ~80ms.',
  },
  {
    title: 'How to run a one-off script inside a NestJS app context',
    type: KnowledgeType.HOW_TO,
    content:
      'Use createApplicationContext to get DI without starting the HTTP server:\n\n' +
      '```ts\nconst app = await NestFactory.createApplicationContext(AppModule);\n' +
      'const svc = app.get(MyService);\nawait svc.doThing();\nawait app.close();\n```',
  },
  {
    title: 'Why we split embeddings out of the Claude pipeline',
    type: KnowledgeType.ARCHITECTURE,
    content:
      'Anthropic does not expose an embeddings endpoint, so we generate vectors ' +
      'locally with all-MiniLM-L6-v2 via transformers.js and store them in ' +
      'Qdrant. Claude is reserved for tagging, summarisation and RAG answer ' +
      'synthesis. This keeps embedding free and offline while still using ' +
      'Claude where it adds the most value.',
  },
  {
    title: 'Cosine vs dot-product distance in Qdrant',
    type: KnowledgeType.INSIGHT,
    content:
      'Because all-MiniLM embeddings are L2-normalised, cosine and dot product ' +
      'rank identically. We use Cosine in the collection config for clarity. ' +
      'If you switch to an un-normalised model, prefer Dot and normalise yourself.',
  },
  {
    title: 'Daily log — 2026-06-27',
    type: KnowledgeType.DAILY_LOG,
    content:
      'Scaffolded the personal knowledge base: NestJS + TypeORM/MySQL backend, ' +
      'Qdrant vector search, Claude-powered enrichment and chat, and a Next.js ' +
      '14 frontend. Next: add auth and pagination.',
  },
];

async function run() {
  const logger = new Logger('seed');
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(KnowledgeService);

  for (const sample of samples) {
    const created = await service.create(sample);
    logger.log(`Seeded: ${created.title} (${created.id})`);
  }

  logger.log(`Done — inserted ${samples.length} entries.`);
  await app.close();
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', e);
  process.exit(1);
});
