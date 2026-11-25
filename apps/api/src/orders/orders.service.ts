import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { REGION_CURRENCY, type MomoNetwork, type PlaceOrderData, type PromoReason, type Region } from '@septer-m/shared';
import type { AuthUser } from '../auth/auth.guard';
import { toHttpError, unwrap } from '../common/db-errors';
import { PaymentsService } from '../payments/payments.service';
import type { PayableOrder, PaymentAction, PaymentChoice } from '../payments/payments.types';
import { SupabaseService } from '../supabase/supabase.service';
import { ORDER_SELECT, toOrderDto, type OrderRow } from './order.mapper';
import { priceItems, priceOrder, PricingError, type PricedProductRow } from './pricing';

const PAYMENT_WINDOW_MINUTES = 30;

const PROMO_MESSAGES: Record<PromoReason, string> = {
  NOT_FOUND: 'That code isn’t valid.',
  INACTIVE: 'That code isn’t valid.',
  NOT_STARTED: 'That code isn’t active yet.',
  EXPIRED: 'That code has expired.',
  USED_UP: 'That code has been fully used.',
  MIN_SUBTOTAL: 'Add more to your bag to use this code.',
  FIRST_ORDER_ONLY: 'That code is for first orders only.',
  ALREADY_USED: 'You’ve already used that code.',
  EMAIL_REQUIRED: 'Enter your email address first, then apply the code.',
};

export interface PromoCheck {
  valid: boolean;
  code?: string;
  discount: number;
  description?: string;
  reason?: PromoReason;
  min?: number;
}

type Row = OrderRow & { public_token: string };

@Injectable()
export class OrdersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly payments: PaymentsService,
  ) {}

  private async products(slugs: string[]): Promise<PricedProductRow[]> {
    return unwrap<PricedProductRow[]>(
      await this.supabase.admin.from('products').select('slug, name, status, prices:product_prices(currency, amount)').in('slug', [...new Set(slugs)]),
    );
  }

  private unavailable(e: unknown): never {
    if (e instanceof PricingError) {
      const message = e.code === 'INVALID_SHIPPING' ? 'Choose a valid delivery option.' : 'A product in your bag is no longer available.';
      throw new UnprocessableEntityException({ code: e.code, message, detail: e.subject });
    }
    throw e;
  }

  /** Works out the products total and what a promo code takes off, without creating anything. */
  async quote(input: { items: { slug: string; qty: number }[]; region: Region; email?: string; promoCode?: string }): Promise<{ subtotal: number; promo?: PromoCheck }> {
    const products = await this.products(input.items.map((i) => i.slug));
    let subtotal: number;
    try {
      subtotal = priceItems(input.items, products, REGION_CURRENCY[input.region]);
    } catch (e) {
      this.unavailable(e);
    }
    if (!input.promoCode) return { subtotal };
    const res = await this.supabase.admin.rpc('validate_discount', {
      p_code: input.promoCode, p_email: input.email ?? '', p_region: input.region, p_subtotal: subtotal,
    });
    if (res.error) throw toHttpError(res.error);
    const v = res.data as { valid: boolean; code?: string; discount?: number; description?: string; reason?: PromoReason; min?: number };
    return { subtotal, promo: { valid: v.valid, code: v.code, discount: v.valid ? (v.discount ?? 0) : 0, description: v.description, reason: v.reason, min: v.min } };
  }

  /** Prices the bag from live data, applies any promo code, then lets the database reserve stock and write the order atomically. */
  async create(input: PlaceOrderData, user?: AuthUser) {
    const { items, checkout, promoCode } = input;
    const products = await this.products(items.map((i) => i.slug));

    let pricing;
    try {
      pricing = priceOrder({
        items, products, region: checkout.region,
        ghRegion: checkout.region === 'GH' ? checkout.address.region : undefined,
        shippingId: checkout.shippingId,
      });
    } catch (e) {
      this.unavailable(e);
    }

    let discount = 0;
    if (promoCode) {
      const { promo } = await this.quote({ items, region: checkout.region, email: checkout.email, promoCode });
      if (!promo?.valid) {
        throw new UnprocessableEntityException({
          code: 'PROMO_INVALID', reason: promo?.reason, min: promo?.min, message: PROMO_MESSAGES[promo?.reason ?? 'NOT_FOUND'],
        });
      }
      discount = promo.discount;
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
      p_discount_code: promoCode ?? null,
      p_expected_discount: discount,
    });
    if (res.error) {
      if (res.error.message === 'DISCOUNT_INVALID') {
        const reason = (res.error.details ?? 'NOT_FOUND') as PromoReason;
        throw new UnprocessableEntityException({ code: 'PROMO_INVALID', reason, message: PROMO_MESSAGES[reason] ?? PROMO_MESSAGES.NOT_FOUND });
      }
      throw toHttpError(res.error);
    }

    const order = res.data as { number: string; token: string; subtotal: number; discount: number; shipping_cost: number; total: number; currency: string; expires_at: string };
    const payment = await this.payments.start(
      { number: order.number, token: order.token, email: checkout.email.toLowerCase(), total: order.total, currency: pricing.currency, region: checkout.region },
      this.choice(checkout.payment),
    );
    return {
      number: order.number,
      /** Proves ownership of a guest order; the confirmation page sends it back with the number. */
      token: order.token,
      currency: order.currency,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingCost: order.shipping_cost,
      total: order.total,
      expiresAt: order.expires_at,
      payment,
    };
  }

  private choice(p: PlaceOrderData['checkout']['payment']): PaymentChoice {
    return p.method === 'momo' ? { method: 'momo', network: p.network, phone: p.phone } : { method: 'card' };
  }

  private async byToken(number: string, token: string): Promise<Row> {
    const row = unwrap<Row | null>(
      await this.supabase.admin.from('orders').select(ORDER_SELECT).eq('number', number).eq('public_token', token).maybeSingle(),
    );
    if (!row) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    return row;
  }

  private payable(row: Row): PayableOrder {
    if (row.status !== 'pending_payment' || (row.expires_at && new Date(row.expires_at) < new Date())) {
      throw new ConflictException({ code: 'ORDER_NOT_PAYABLE', message: 'This order can no longer be paid. Please place a new order.' });
    }
    return { number: row.number, token: row.public_token, email: row.email, total: row.total, currency: row.currency, region: row.region };
  }

  /** (Re)starts payment for an unpaid order, e.g. after a failed card or an abandoned page. */
  async startPayment(number: string, token: string): Promise<{ payment: PaymentAction }> {
    const row = await this.byToken(number, token);
    const method = row.payment as { method: 'card' | 'momo'; network?: MomoNetwork; phone?: string };
    const choice: PaymentChoice = method.method === 'momo' && method.network && method.phone ? { method: 'momo', network: method.network, phone: method.phone } : { method: 'card' };
    return { payment: await this.payments.start(this.payable(row), choice) };
  }

  async submitOtp(number: string, token: string, reference: string, otp: string): Promise<{ payment: PaymentAction }> {
    const row = await this.byToken(number, token);
    const method = row.payment as { method: string; network?: MomoNetwork };
    if (method.method !== 'momo' || !method.network) throw new ConflictException({ code: 'ORDER_NOT_PAYABLE', message: 'This order is not paid by Mobile Money.' });
    return { payment: await this.payments.submitMomoOtp(this.payable(row), method.network, reference, otp) };
  }

  /** Guest lookup. A wrong number or token gives the same 404 so order numbers cannot be probed. */
  async getForGuest(number: string, token: string) {
    return toOrderDto(await this.byToken(number, token));
  }

  /** "Where is my order?": number plus the email it was placed with. */
  async track(number: string, email: string) {
    const row = unwrap<OrderRow | null>(
      await this.supabase.admin.from('orders').select(ORDER_SELECT).eq('number', number).eq('email', email.toLowerCase()).maybeSingle(),
    );
    if (!row) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'We couldn’t find an order with that number and email.' });
    return toOrderDto(row);
  }

  async listForUser(userId: string) {
    const rows = unwrap<OrderRow[]>(
      await this.supabase.admin.from('orders').select(ORDER_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    );
    return rows.map(toOrderDto);
  }
}
