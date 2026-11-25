import { Injectable, Logger } from '@nestjs/common';
import type { Currency } from '@septer-m/shared';
import { getEnv } from '../config/env';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import { orderConfirmation, orderShipped, type EmailOrder } from './templates';

interface Row {
  number: string;
  public_token: string;
  email: string;
  currency: Currency;
  subtotal: number;
  discount: number;
  discount_code: string | null;
  shipping_label: string;
  shipping_cost: number;
  total: number;
  shipping_address: Record<string, unknown>;
  items: { name: string; qty: number; unit_price: number }[];
}

/** Sends the customer emails that go with order events. Failures are logged, never thrown. */
@Injectable()
export class OrderNotifier {
  private readonly log = new Logger('OrderNotifier');

  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailService,
  ) {}

  private async load(number: string): Promise<{ order: EmailOrder; trackUrl: string } | null> {
    const { data } = await this.supabase.admin
      .from('orders')
      .select('number, public_token, email, currency, subtotal, discount, discount_code, shipping_label, shipping_cost, total, shipping_address, items:order_items(name, qty, unit_price)')
      .eq('number', number)
      .maybeSingle();
    const r = data as Row | null;
    if (!r) return null;
    const web = getEnv().WEB_URL ?? '';
    return {
      trackUrl: `${web}/track?order=${encodeURIComponent(r.number)}&token=${r.public_token}`,
      order: {
        number: r.number, email: r.email, currency: r.currency, subtotal: r.subtotal, discount: r.discount, discountCode: r.discount_code,
        shippingLabel: r.shipping_label, shippingCost: r.shipping_cost, total: r.total, address: r.shipping_address,
        lines: (r.items ?? []).map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unit_price })),
      },
    };
  }

  async confirmed(number: string): Promise<void> {
    try {
      const o = await this.load(number);
      if (o) await this.email.send(o.order.email, orderConfirmation(o.order, o.trackUrl));
    } catch (e) {
      this.log.error(`Confirmation email for ${number} failed: ${(e as Error).message}`);
    }
  }

  async shipped(number: string, note?: string): Promise<void> {
    try {
      const o = await this.load(number);
      if (o) await this.email.send(o.order.email, orderShipped(o.order, note, o.trackUrl));
    } catch (e) {
      this.log.error(`Shipping email for ${number} failed: ${(e as Error).message}`);
    }
  }
}
