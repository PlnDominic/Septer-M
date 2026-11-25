import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminProductData, Currency, OrderStatus, Region } from '@septer-m/shared';
import { toHttpError, unwrap } from '../common/db-errors';
import { PRODUCT_SELECT, toAdminProductDto, type ProductRow } from '../catalog/product.mapper';
import { ORDER_SELECT, toOrderDto, type OrderRow } from '../orders/order.mapper';
import { SupabaseService } from '../supabase/supabase.service';

/** Removes characters that have meaning inside a PostgREST `or(...)` filter. */
export const sanitizeSearch = (q: string) => q.replace(/[^\p{L}\p{N}@._\- ]/gu, '').trim().slice(0, 60);

@Injectable()
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}

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

  setOrderStatus(number: string, status: OrderStatus, note: string | undefined, actorId: string) {
    return this.rpc('set_order_status', { p_order_number: number, p_status: status, p_note: note ?? null, p_actor: actorId });
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
