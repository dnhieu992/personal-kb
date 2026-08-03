import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // CORS: the frontend reaches the API through a same-origin proxy
  // (/api-proxy), so cross-origin calls normally don't happen. Reflect the
  // request origin so direct browser access from any host still works.
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Swagger docs at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Personal Knowledge Base API')
    .setDescription('CRUD + semantic search + AI chat over your knowledge base')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('PORT', 3001);
  const server = await app.listen(port);

  // The frontend proxies through Next, whose agent pools keep-alive sockets to
  // us and never expires them. Any idle timeout on our side is therefore a race:
  // we close a socket the proxy still believes is good, it sends a request into
  // it, and the browser gets a 500 ("socket hang up" in the Next log). 0 means
  // we never close an idle socket — the proxy owns that decision. requestTimeout
  // (5 min, unchanged) still caps a request that stalls mid-flight.
  server.keepAliveTimeout = 0;
  server.headersTimeout = 66_000;
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${port} (docs: /api/docs)`);
}
bootstrap();
