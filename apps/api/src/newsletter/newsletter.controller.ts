import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { subscribeSchema } from '@septer-m/shared';
import { toHttpError } from '../common/db-errors';
import { clientIp, RateLimiter } from '../common/rate-limiter';
import { ZodPipe } from '../common/zod.pipe';
import { getEnv } from '../config/env';
import { EmailService } from '../emails/email.service';
import { welcomeOffer } from '../emails/templates';
import { SupabaseService } from '../supabase/supabase.service';

const unsubQuery = z.object({ token: z.string().uuid('Invalid link') });

@Controller()
export class NewsletterController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailService,
    private readonly limiter: RateLimiter,
  ) {}

  /** Joins the list and emails a one-off 10% welcome code. The reply is the same whether or not the address was already on the list. */
  @Post('subscribe')
  @HttpCode(200)
  async subscribe(@Body(new ZodPipe(subscribeSchema)) body: z.output<typeof subscribeSchema>, @Req() req: FastifyRequest) {
    this.limiter.check('subscribe', clientIp(req), 5, 60_000);
    const res = await this.supabase.admin.rpc('subscribe_email', { p_email: body.email, p_source: body.source ?? 'website' });
    if (res.error) throw toHttpError(res.error);
    const sub = res.data as { code: string; isNew: boolean; token: string };
    if (sub.isNew) {
      const web = getEnv().WEB_URL ?? '';
      await this.email.send(body.email, welcomeOffer(sub.code, `${web}/shop`, `${web}/unsubscribe?token=${sub.token}`));
    }
    return { ok: true, message: 'Thanks! If this is your first time, your 10% code is on its way to your inbox.' };
  }

  @Get('unsubscribe')
  async unsubscribe(@Query(new ZodPipe(unsubQuery)) query: z.output<typeof unsubQuery>) {
    const res = await this.supabase.admin.rpc('unsubscribe_email', { p_token: query.token });
    if (res.error) throw toHttpError(res.error);
    return { ok: true };
  }
}
