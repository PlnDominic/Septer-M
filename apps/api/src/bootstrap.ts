import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

/** Shared by the local server (main.ts) and the Vercel function (api/index.ts). */
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    // Payment webhooks verify signatures against the raw body.
    rawBody: true,
  });
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',').map((o) => o.trim()) ?? true });
  return app;
}
