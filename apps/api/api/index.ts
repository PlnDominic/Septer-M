import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/bootstrap';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

// Cache the initialised app across warm invocations.
let handler: Promise<Handler> | undefined;

async function init(): Promise<Handler> {
  const app = await createApp();
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function (req: IncomingMessage, res: ServerResponse) {
  handler ??= init();
  return (await handler)(req, res);
}
