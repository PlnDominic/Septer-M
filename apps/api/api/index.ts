import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/bootstrap';

type Server = { emit(event: 'request', req: IncomingMessage, res: ServerResponse): void };

// Cache the initialised app across warm invocations.
let server: Promise<Server> | undefined;

async function init(): Promise<Server> {
  const app = await createApp();
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  return fastify.server as Server;
}

export default async function (req: IncomingMessage, res: ServerResponse) {
  server ??= init();
  (await server).emit('request', req, res);
}
