import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { placeOrderSchema, promoValidateSchema, trackOrderSchema, type PlaceOrderData } from '@septer-m/shared';
import { OptionalAuthGuard, type AuthUser } from '../auth/auth.guard';
import { CurrentUser, SignedIn } from '../auth/roles';
import { clientIp, RateLimiter } from '../common/rate-limiter';
import { ZodPipe } from '../common/zod.pipe';
import { OrdersService } from './orders.service';

const tokenQuery = z.object({ token: z.string().uuid('Invalid order link') });
const tokenBody = z.object({ token: z.string().uuid('Invalid order link') });
const otpBody = z.object({ token: z.string().uuid(), reference: z.string().min(3).max(80), otp: z.string().trim().min(3).max(12) });

@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly limiter: RateLimiter,
  ) {}

  /** Guest or signed-in checkout. Returns what the shopper must do next to pay. */
  @Post('orders')
  @UseGuards(OptionalAuthGuard)
  create(@Body(new ZodPipe(placeOrderSchema)) body: PlaceOrderData, @Req() req: FastifyRequest, @CurrentUser() user?: AuthUser) {
    this.limiter.check('order', clientIp(req), 20, 60_000);
    return this.orders.create(body, user);
  }

  /** Checks a promo code against the bag. The server works out the discount. */
  @Post('promo/validate')
  async validatePromo(@Body(new ZodPipe(promoValidateSchema)) body: z.output<typeof promoValidateSchema>, @Req() req: FastifyRequest) {
    this.limiter.check('promo', clientIp(req), 30, 60_000);
    const { subtotal, promo } = await this.orders.quote({ items: body.items, region: body.region, email: body.email, promoCode: body.code });
    return { subtotal, ...promo };
  }

  @Post('orders/track')
  track(@Body(new ZodPipe(trackOrderSchema)) body: z.output<typeof trackOrderSchema>, @Req() req: FastifyRequest) {
    this.limiter.check('track', clientIp(req), 10, 60_000);
    return this.orders.track(body.number, body.email);
  }

  @Get('orders/:number')
  getForGuest(@Param('number') number: string, @Query(new ZodPipe(tokenQuery)) query: z.output<typeof tokenQuery>) {
    return this.orders.getForGuest(number, query.token);
  }

  /** Try paying again for an unpaid order. */
  @Post('orders/:number/payment')
  retryPayment(@Param('number') number: string, @Body(new ZodPipe(tokenBody)) body: z.output<typeof tokenBody>, @Req() req: FastifyRequest) {
    this.limiter.check('pay', clientIp(req), 20, 60_000);
    return this.orders.startPayment(number, body.token);
  }

  /** Some Mobile Money networks send a one-time code that must be entered to approve the payment. */
  @Post('orders/:number/payment/otp')
  submitOtp(@Param('number') number: string, @Body(new ZodPipe(otpBody)) body: z.output<typeof otpBody>, @Req() req: FastifyRequest) {
    this.limiter.check('otp', clientIp(req), 10, 60_000);
    return this.orders.submitOtp(number, body.token, body.reference, body.otp);
  }

  @Get('me/orders')
  @SignedIn()
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.listForUser(user.id);
  }

  @Get('me')
  @SignedIn()
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
