import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  adminProductSchema,
  ORDER_STATUSES,
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
