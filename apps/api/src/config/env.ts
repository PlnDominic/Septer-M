import { ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';

/** Empty values in .env files (KEY=) count as "not set". */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /** Shared secret that protects scheduled-job endpoints (Vercel Cron sends it as a bearer token). */
  CRON_SECRET: optional(z.string().min(16)),
  /** Public address of the storefront, used for payment return links and email links. */
  WEB_URL: optional(z.string().url()),
  STRIPE_SECRET_KEY: optional(z.string().min(8)),
  STRIPE_WEBHOOK_SECRET: optional(z.string().min(8)),
  PAYSTACK_SECRET_KEY: optional(z.string().min(8)),
  RESEND_API_KEY: optional(z.string().min(8)),
  /** e.g. "Septer-M <orders@your-domain.com>". Must be a domain verified with Resend. */
  EMAIL_FROM: optional(z.string().min(5)),
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

/** For tests: forget the cached environment so changed variables are re-read. */
export function resetEnvCache() {
  cached = undefined;
}
