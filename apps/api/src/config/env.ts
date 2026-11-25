import { ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /** Shared secret that protects scheduled-job endpoints (Vercel Cron sends it as a bearer token). */
  CRON_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Read lazily so the app (and /health) boots without secrets and fails clearly on first use. */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    console.error(`[config] Missing or invalid environment variables: ${missing}`);
    throw new ServiceUnavailableException({ code: 'NOT_CONFIGURED', message: 'The server is not configured yet.' });
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}
