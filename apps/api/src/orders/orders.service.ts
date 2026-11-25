import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { PlaceOrderData } from '@septer-m/shared';
import type { AuthUser } from '../auth/auth.guard';
import { toHttpError, unwrap } from '../common/db-errors';
import { SupabaseService } from '../supabase/supabase.service';
import { ORDER_SELECT, toOrderDto, type OrderRow } from './order.mapper';
import { priceOrder, PricingError, type PricedProductRow } from './pricing';

const PAYMENT_WINDOW_MINUTES = 30;

@Injectable()
export class OrdersService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Prices the bag from live data, then lets the database reserve stock and write the order atomically. */
  async create(input: PlaceOrderData, user?: AuthUser) {
    const { items, checkout } = input;
    const slugs = [...new Set(items.map((i) => i.slug))];

    const products = unwrap<PricedProductRow[]>(
      await this.supabase.admin.from('products').select('slug, name, status, prices:product_prices(currency, amount)').in('slug', slugs),
    );

    let pricing;
    try {
      pricing = priceOrder({
        items,
        products,
        region: checkout.region,
        ghRegion: checkout.region === 'GH' ? checkout.address.region : undefined,
        shippingId: checkout.shippingId,
      });
    } catch (e) {
      if (e instanceof PricingError) {
        const message = e.code === 'INVALID_SHIPPING' ? 'Choose a valid delivery option.' : 'A product in your bag is no longer available.';
        throw new UnprocessableEntityException({ code: e.code, message, detail: e.subject });
      }
      throw e;
    }

    const res = await this.supabase.admin.rpc('create_order', {
      p_user_id: user?.id ?? null,
      p_email: checkout.email,
      p_region: checkout.region,
      p_shipping_address: checkout.address,
      p_shipping_method_id: pricing.shipping.id,
      p_shipping_label: pricing.shipping.label,
      p_shipping_detail: pricing.shipping.detail,
      p_shipping_cost: pricing.shippingCost,
      p_payment: checkout.payment,
      p_items: items,
      p_expected_subtotal: pricing.subtotal,
      p_ttl_minutes: PAYMENT_WINDOW_MINUTES,
    });
    if (res.error) throw toHttpError(res.error);

    const order = res.data as { number: string; token: string; subtotal: number; shipping_cost: number; total: number; currency: string; expires_at: string };
    return {
      number: order.number,
      /** Proves ownership of a guest order; the confirmation page sends it back with the number. */
      token: order.token,
      currency: order.currency,
      subtotal: order.subtotal,
      shippingCost: order.shipping_cost,
      total: order.total,
      expiresAt: order.expires_at,
    };
  }

  /** Guest lookup. A wrong number or token gives the same 404 so order numbers cannot be probed. */
  async getForGuest(number: string, token: string) {
    const row = unwrap<OrderRow | null>(
      await this.supabase.admin.from('orders').select(ORDER_SELECT).eq('number', number).eq('public_token', token).maybeSingle(),
    );
    if (!row) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    return toOrderDto(row);
  }

  async listForUser(userId: string) {
    const rows = unwrap<OrderRow[]>(
      await this.supabase.admin.from('orders').select(ORDER_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    );
    return rows.map(toOrderDto);
  }
}
