import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

/** Prefix and CORS, applied to the real server and to test apps alike. Browsers need PUT and DELETE listed explicitly (the admin uses them). */
export function configureApp(app: NestFastifyApplication): void {
  app.setGlobalPrefix('v1');
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',').map((o) => o.trim()) ?? true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
}

/** Shared by the local server (main.ts) and the Vercel function (api/index.ts). */
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    // Payment webhooks verify signatures against the raw body.
    rawBody: true,
  });
  configureApp(app);
  return app;
}
