import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminDiscountInput, AdminProductData, Currency, OrderStatus, Region } from '@septer-m/shared';
import { OrderNotifier } from '../emails/order-notifier.service';
import { toHttpError, unwrap } from '../common/db-errors';
import { PRODUCT_SELECT, toAdminProductDto, type ProductRow } from '../catalog/product.mapper';
import { ORDER_SELECT, toOrderDto, type OrderRow } from '../orders/order.mapper';
import { SupabaseService } from '../supabase/supabase.service';

/** Removes characters that have meaning inside a PostgREST `or(...)` filter. */
export const sanitizeSearch = (q: string) => q.replace(/[^\p{L}\p{N}@._\- ]/gu, '').trim().slice(0, 60);

@Injectable()
export class AdminService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifier: OrderNotifier,
  ) {}

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const res = await this.supabase.admin.rpc(fn, args);
    if (res.error) throw toHttpError(res.error);
    return res.data as T;
  }

  dashboard(currency: Currency, days: number) {
    return this.rpc('admin_dashboard', { p_currency: currency, p_days: days });
  }

  customers() {
    return this.rpc('admin_customers');
  }

  orderCounts() {
    return this.rpc<Record<string, number>>('admin_order_counts');
  }

  async listOrders(f: { status?: OrderStatus; region?: Region; q?: string; limit: number; offset: number }) {
    let query = this.supabase.admin
      .from('orders')
      .select(ORDER_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(f.offset, f.offset + f.limit - 1);
    if (f.status) query = query.eq('status', f.status);
    if (f.region) query = query.eq('region', f.region);
    const term = f.q ? sanitizeSearch(f.q) : '';
    if (term) {
      query = query.or(
        ['number', 'email', 'shipping_address->>firstName', 'shipping_address->>lastName'].map((c) => `${c}.ilike.%${term}%`).join(','),
      );
    }
    const res = await query;
    if (res.error) throw toHttpError(res.error);
    return { total: res.count ?? 0, orders: (res.data as OrderRow[]).map(toOrderDto) };
  }

  async getOrder(number: string) {
    const row = unwrap<(OrderRow & { payments?: unknown[] }) | null>(
      await this.supabase.admin
        .from('orders')
        .select(`${ORDER_SELECT}, payments(provider, provider_ref, amount, currency, status, created_at)`)
        .eq('number', number)
        .maybeSingle(),
    );
    if (!row) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    return { ...toOrderDto(row), userId: row.user_id, payments: row.payments ?? [] };
  }

  async setOrderStatus(number: string, status: OrderStatus, note: string | undefined, actorId: string) {
    const result = await this.rpc<{ number: string; status: OrderStatus }>('set_order_status', { p_order_number: number, p_status: status, p_note: note ?? null, p_actor: actorId });
    // Tell the customer when their order is on its way (the note is where tracking details go).
    if (status === 'shipped') void this.notifier.shipped(number, note);
    return result;
  }

  async listDiscounts() {
    const rows = unwrap<Record<string, unknown>[]>(await this.supabase.admin.from('discount_codes').select('*').order('created_at', { ascending: false }).limit(200));
    return rows.map((r) => ({
      id: r.id, code: r.code, description: r.description, kind: r.kind, percent: r.percent, amountGbp: r.amount_gbp, amountGhs: r.amount_ghs,
      minSubtotalGbp: r.min_subtotal_gbp, minSubtotalGhs: r.min_subtotal_ghs, maxUses: r.max_uses, uses: r.uses,
      firstOrderOnly: r.first_order_only, onePerEmail: r.one_per_email, restrictedEmail: r.restricted_email,
      startsAt: r.starts_at, endsAt: r.ends_at, active: r.active, createdAt: r.created_at,
    }));
  }

  async createDiscount(d: Required<Pick<AdminDiscountInput, 'code' | 'kind'>> & AdminDiscountInput) {
    const res = await this.supabase.admin.from('discount_codes').insert({
      code: d.code, description: d.description ?? '', kind: d.kind,
      percent: d.kind === 'percent' ? d.percent : null,
      amount_gbp: d.kind === 'fixed' ? d.amountGbp : null, amount_ghs: d.kind === 'fixed' ? d.amountGhs : null,
      min_subtotal_gbp: d.minSubtotalGbp ?? 0, min_subtotal_ghs: d.minSubtotalGhs ?? 0,
      max_uses: d.maxUses ?? null, first_order_only: d.firstOrderOnly ?? false, one_per_email: d.onePerEmail ?? true,
      starts_at: d.startsAt ?? null, ends_at: d.endsAt ?? null,
    }).select('id, code').single();
    if (res.error) throw toHttpError(res.error);
    return res.data;
  }

  async setDiscountActive(id: string, active: boolean) {
    const res = await this.supabase.admin.from('discount_codes').update({ active }).eq('id', id).select('id, code, active');
    if (res.error) throw toHttpError(res.error);
    if (!res.data?.length) throw new NotFoundException({ code: 'DISCOUNT_NOT_FOUND', message: 'Promo code not found.' });
    return res.data[0];
  }

  async listReviews(status: 'pending' | 'approved' | 'rejected') {
    const rows = unwrap<{ id: string; rating: number; title: string; body: string; display_name: string; status: string; created_at: string; product: { slug: string; name: string } | { slug: string; name: string }[] | null }[]>(
      await this.supabase.admin.from('reviews').select('id, rating, title, body, display_name, status, created_at, product:products(slug, name)').eq('status', status).order('created_at', { ascending: false }).limit(200),
    );
    return rows.map((r) => {
      const p = Array.isArray(r.product) ? r.product[0] : r.product;
      return { id: r.id, rating: r.rating, title: r.title, body: r.body, name: r.display_name, status: r.status, createdAt: r.created_at, productSlug: p?.slug, productName: p?.name };
    });
  }

  moderateReview(id: string, status: 'pending' | 'approved' | 'rejected') {
    return this.rpc('moderate_review', { p_id: id, p_status: status });
  }

  async listProducts() {
    const rows = unwrap<ProductRow[]>(await this.supabase.admin.from('products').select(PRODUCT_SELECT).order('created_at'));
    return rows.map(toAdminProductDto);
  }

  async getProduct(slug: string) {
    const row = unwrap<ProductRow | null>(await this.supabase.admin.from('products').select(PRODUCT_SELECT).eq('slug', slug).maybeSingle());
    if (!row) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    return toAdminProductDto(row);
  }

  async saveProduct(input: AdminProductData, originalSlug?: string) {
    const saved = await this.rpc<{ slug: string }>('admin_upsert_product', { p_product: input, p_original_slug: originalSlug ?? null });
    return this.getProduct(saved.slug);
  }

  async deleteProduct(slug: string) {
    const res = await this.supabase.admin.from('products').delete().eq('slug', slug).select('slug');
    if (res.error) throw toHttpError(res.error);
    if (!res.data?.length) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    return { deleted: slug };
  }
}
