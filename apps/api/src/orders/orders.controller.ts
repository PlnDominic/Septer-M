import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { placeOrderSchema, type PlaceOrderData } from '@septer-m/shared';
import { OptionalAuthGuard, type AuthUser } from '../auth/auth.guard';
import { CurrentUser, SignedIn } from '../auth/roles';
import { ZodPipe } from '../common/zod.pipe';
import { OrdersService } from './orders.service';

const tokenQuery = z.object({ token: z.string().uuid('Invalid order link') });

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Guest or signed-in checkout. */
  @Post('orders')
  @UseGuards(OptionalAuthGuard)
  create(@Body(new ZodPipe(placeOrderSchema)) body: PlaceOrderData, @CurrentUser() user?: AuthUser) {
    return this.orders.create(body, user);
  }

  @Get('orders/:number')
  getForGuest(@Param('number') number: string, @Query(new ZodPipe(tokenQuery)) query: z.output<typeof tokenQuery>) {
    return this.orders.getForGuest(number, query.token);
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
