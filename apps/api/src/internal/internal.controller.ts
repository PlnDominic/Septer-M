import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { getEnv } from '../config/env';
import { toHttpError } from '../common/db-errors';
import { SupabaseService } from '../supabase/supabase.service';

export function isValidCronAuth(header: string | undefined, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Endpoints for schedulers (Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`). */
@Controller('internal')
export class InternalController {
  constructor(private readonly supabase: SupabaseService) {}

  /** Cancels unpaid orders past their payment window and returns their stock. */
  @Get('release-expired')
  async releaseExpired(@Headers('authorization') authorization?: string) {
    if (!isValidCronAuth(authorization, getEnv().CRON_SECRET)) throw new UnauthorizedException();
    const res = await this.supabase.admin.rpc('release_expired_orders');
    if (res.error) throw toHttpError(res.error);
    return { released: res.data as number };
  }
}
