import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { reviewSchema, type ReviewInput } from '@septer-m/shared';
import type { AuthUser } from '../auth/auth.guard';
import { CurrentUser, SignedIn } from '../auth/roles';
import { toHttpError, unwrap } from '../common/db-errors';
import { ZodPipe } from '../common/zod.pipe';
import { SupabaseService } from '../supabase/supabase.service';

interface ReviewRow {
  rating: number;
  title: string;
  body: string;
  display_name: string;
  created_at: string;
}

@Controller('products/:slug/reviews')
export class ReviewsController {
  constructor(private readonly supabase: SupabaseService) {}

  private async productId(slug: string): Promise<string> {
    const row = unwrap<{ id: string } | null>(await this.supabase.admin.from('products').select('id').eq('slug', slug).eq('status', 'active').maybeSingle());
    if (!row) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    return row.id;
  }

  /** Approved reviews only. Every review comes from a customer whose order shipped, so all are "verified". */
  @Get()
  async list(@Param('slug') slug: string) {
    const id = await this.productId(slug);
    const rows = unwrap<ReviewRow[]>(
      await this.supabase.admin.from('reviews').select('rating, title, body, display_name, created_at').eq('product_id', id).eq('status', 'approved').order('created_at', { ascending: false }).limit(200),
    );
    const distribution = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: rows.filter((r) => r.rating === stars).length }));
    const count = rows.length;
    const average = count ? Math.round((rows.reduce((n, r) => n + r.rating, 0) / count) * 10) / 10 : 0;
    return {
      summary: { average, count, distribution },
      reviews: rows.slice(0, 50).map((r) => ({ rating: r.rating, title: r.title, body: r.body, name: r.display_name, date: r.created_at, verified: true })),
    };
  }

  /** Can this signed-in customer leave a review? (They must have received the product and not reviewed it yet.) */
  @Get('eligibility')
  @SignedIn()
  async eligibility(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const id = await this.productId(slug);
    const bought = unwrap<{ id: string }[]>(
      await this.supabase.admin.from('order_items').select('id, orders!inner(user_id, status)').eq('product_id', id).eq('orders.user_id', user.id).in('orders.status', ['shipped', 'delivered']).limit(1),
    );
    if (bought.length === 0) return { canReview: false, reason: 'NOT_PURCHASED' };
    const existing = unwrap<{ id: string }[]>(await this.supabase.admin.from('reviews').select('id').eq('product_id', id).eq('user_id', user.id).limit(1));
    return existing.length ? { canReview: false, reason: 'ALREADY_REVIEWED' } : { canReview: true };
  }

  @Post()
  @SignedIn()
  async submit(@Param('slug') slug: string, @Body(new ZodPipe(reviewSchema)) body: ReviewInput, @CurrentUser() user: AuthUser) {
    const input = body as { rating: number; title: string; body: string; name: string };
    const res = await this.supabase.admin.rpc('submit_review', {
      p_user_id: user.id, p_slug: slug, p_rating: input.rating, p_title: input.title, p_body: input.body, p_name: input.name,
    });
    if (res.error) throw toHttpError(res.error);
    return { status: 'pending', message: 'Thank you! Your review will appear once it has been checked.' };
  }
}
