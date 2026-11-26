import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { loadEnv } from './platform/config/config';
import { loadDotenv } from './platform/config/load-dotenv';

async function bootstrap() {
  loadDotenv();
  const env = loadEnv(); // fail fast before Nest spins anything up
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser('json', { limit: '2mb' });
  app.use(cookieParser());
  // Behind the Next.js proxy: trust X-Forwarded-For for the login rate limit.
  app.set('trust proxy', 'loopback');
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  // No CORS on purpose: the browser only talks to the web origin, which proxies /api.
  await app.listen(env.PORT, env.HOST);
  new Logger('Bootstrap').log(`API listening on http://${env.HOST}:${env.PORT}/api (tz ${env.APP_TZ})`);
}
bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e.message ?? e);
  process.exit(1);
});
