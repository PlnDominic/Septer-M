import { createHmac, timingSafeEqual } from 'node:crypto';

const safeEqualHex = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Verifies Stripe's `Stripe-Signature` header (`t=timestamp,v1=hex[,v1=hex]`): an HMAC-SHA256 of
 * `${t}.${rawBody}`. The timestamp must be recent so a captured request cannot be replayed later.
 */
export function verifyStripeSignature(rawBody: Buffer | string, header: string | undefined, secret: string, toleranceSeconds = 300, nowMs = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim().split('=') as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || signatures.length === 0 || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex');
  return signatures.some((s) => safeEqualHex(s, expected));
}

/** Verifies Paystack's `x-paystack-signature`: an HMAC-SHA512 of the raw body keyed with the secret key. */
export function verifyPaystackSignature(rawBody: Buffer | string, header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  return safeEqualHex(header.trim().toLowerCase(), expected);
}

/** Test helpers: produce a header the way each provider would. */
export const signStripe = (rawBody: string, secret: string, tSeconds = Math.floor(Date.now() / 1000)) =>
  `t=${tSeconds},v1=${createHmac('sha256', secret).update(`${tSeconds}.${rawBody}`).digest('hex')}`;
export const signPaystack = (rawBody: string, secret: string) => createHmac('sha512', secret).update(rawBody).digest('hex');
