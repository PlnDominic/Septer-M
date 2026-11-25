import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  adminDiscountSchema,
  adminProductSchema,
  ORDER_STATUSES,
  REVIEW_STATUSES,
  reviewStatusSchema,
  setOrderStatusSchema,
  type AdminProductData,
} from '@septer-m/shared';
import { AdminOnly, CurrentUser } from '../auth/roles';
import type { AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../common/zod.pipe';
import { AdminService } from './admin.service';

const ordersQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  region: z.enum(['UK', 'GH']).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const dashboardQuery = z.object({
  currency: z.enum(['GBP', 'GHS']).default('GBP'),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

@Controller('admin')
@AdminOnly()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard(@Query(new ZodPipe(dashboardQuery)) q: z.output<typeof dashboardQuery>) {
    return this.admin.dashboard(q.currency, q.days);
  }

  @Get('customers')
  customers() {
    return this.admin.customers();
  }

  /* ---- Orders ---- */

  @Get('orders')
  orders(@Query(new ZodPipe(ordersQuery)) q: z.output<typeof ordersQuery>) {
    return this.admin.listOrders(q);
  }

  @Get('orders/counts')
  orderCounts() {
    return this.admin.orderCounts();
  }

  @Get('orders/:number')
  order(@Param('number') number: string) {
    return this.admin.getOrder(number);
  }

  @Post('orders/:number/status')
  setStatus(
    @Param('number') number: string,
    @Body(new ZodPipe(setOrderStatusSchema)) body: z.output<typeof setOrderStatusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.setOrderStatus(number, body.status, body.note, user.id);
  }

  /* ---- Promo codes ---- */

  @Get('discounts')
  discounts() {
    return this.admin.listDiscounts();
  }

  @Post('discounts')
  createDiscount(@Body(new ZodPipe(adminDiscountSchema)) body: z.output<typeof adminDiscountSchema>) {
    return this.admin.createDiscount(body);
  }

  @Post('discounts/:id/active')
  setDiscountActive(@Param('id') id: string, @Body(new ZodPipe(z.object({ active: z.boolean() }))) body: { active: boolean }) {
    return this.admin.setDiscountActive(id, body.active);
  }

  /* ---- Reviews ---- */

  @Get('reviews')
  reviews(@Query(new ZodPipe(z.object({ status: z.enum(REVIEW_STATUSES).default('pending') }))) q: { status: (typeof REVIEW_STATUSES)[number] }) {
    return this.admin.listReviews(q.status);
  }

  @Post('reviews/:id/status')
  moderateReview(@Param('id') id: string, @Body(new ZodPipe(reviewStatusSchema)) body: z.output<typeof reviewStatusSchema>) {
    return this.admin.moderateReview(id, body.status);
  }

  /* ---- Products ---- */

  @Get('products')
  products() {
    return this.admin.listProducts();
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.admin.getProduct(slug);
  }

  @Post('products')
  createProduct(@Body(new ZodPipe(adminProductSchema)) body: AdminProductData) {
    return this.admin.saveProduct(body);
  }

  @Put('products/:slug')
  updateProduct(@Param('slug') slug: string, @Body(new ZodPipe(adminProductSchema)) body: AdminProductData) {
    return this.admin.saveProduct(body, slug);
  }

  @Delete('products/:slug')
  deleteProduct(@Param('slug') slug: string) {
    return this.admin.deleteProduct(slug);
  }
}
