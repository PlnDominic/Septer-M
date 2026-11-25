import { BadRequestException, Controller, Headers, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { getEnv } from '../config/env';
import { PaymentsService } from './payments.service';
import { verifyPaystackSignature, verifyStripeSignature } from './signatures';

const bad = () => new BadRequestException({ code: 'BAD_SIGNATURE', message: 'Signature check failed.' });

function parse(raw: Buffer): Record<string, never> {
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new BadRequestException({ code: 'BAD_PAYLOAD', message: 'Body is not JSON.' });
  }
}

/** Payment providers call these. Nothing is trusted until the signature over the raw body checks out. */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('stripe')
  @HttpCode(200)
  stripe(@Req() req: RawBodyRequest<FastifyRequest>, @Headers('stripe-signature') signature?: string) {
    const secret = getEnv().STRIPE_WEBHOOK_SECRET;
    if (!req.rawBody || !secret || !verifyStripeSignature(req.rawBody, signature, secret)) throw bad();
    return this.payments.handleStripeEvent(parse(req.rawBody));
  }

  @Post('paystack')
  @HttpCode(200)
  paystack(@Req() req: RawBodyRequest<FastifyRequest>, @Headers('x-paystack-signature') signature?: string) {
    const secret = getEnv().PAYSTACK_SECRET_KEY;
    if (!req.rawBody || !secret || !verifyPaystackSignature(req.rawBody, signature, secret)) throw bad();
    return this.payments.handlePaystackEvent(parse(req.rawBody));
  }
}
