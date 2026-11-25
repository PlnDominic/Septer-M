import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/** First address in x-forwarded-for (set by Vercel's proxy), else the socket address. */
export function clientIp(req: FastifyRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.ip || 'unknown';
}

/**
 * Small fixed-window limiter for public endpoints that could be abused (order lookup, promo guessing, signups).
 * It lives in memory, so on serverless each warm instance counts separately: it blunts casual abuse,
 * it is not a hard guarantee. Put Vercel's firewall rate limiting in front for that.
 */
@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  check(bucket: string, key: string, limit: number, windowMs: number, now = Date.now()): void {
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    const id = `${bucket}:${key}`;
    const entry = this.hits.get(id);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(id, { count: 1, resetAt: now + windowMs });
      return;
    }
    entry.count += 1;
    if (entry.count > limit) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a minute and try again.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
