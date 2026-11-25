import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '../common/http.service';
import { getEnv } from '../config/env';
import { PaymentInitError, type PayableOrder } from './payments.types';

/** Hosted Stripe Checkout (cards, plus Apple Pay and Google Pay when enabled in the Stripe dashboard). */
@Injectable()
export class StripeService {
  private readonly log = new Logger('Stripe');

  constructor(private readonly http: HttpService) {}

  async createCheckoutSession(order: PayableOrder, webUrl: string): Promise<{ id: string; url: string }> {
    const key = getEnv().STRIPE_SECRET_KEY;
    if (!key) throw new PaymentInitError('stripe');

    const q = new URLSearchParams({ order: order.number, token: order.token });
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('client_reference_id', order.number);
    form.set('customer_email', order.email);
    form.set('metadata[order_number]', order.number);
    form.set('payment_intent_data[metadata][order_number]', order.number);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', order.currency.toLowerCase());
    form.set('line_items[0][price_data][unit_amount]', String(order.total));
    form.set('line_items[0][price_data][product_data][name]', `Septer-M order ${order.number}`);
    form.set('success_url', `${webUrl}/checkout/confirmation?${q}`);
    form.set('cancel_url', `${webUrl}/checkout?payment=cancelled`);
    // Stripe needs at least 30 minutes; our unpaid orders are released after 30, so stay just above.
    form.set('expires_at', String(Math.floor(Date.now() / 1000) + 31 * 60));

    const res = await this.http.fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `${order.number}-${Math.floor(Date.now() / 60_000)}`,
      },
      body: form.toString(),
    });
    if (!res.ok) {
      this.log.error(`Checkout session for ${order.number} refused (HTTP ${res.status})`);
      throw new PaymentInitError('stripe', res.status);
    }
    const json = (await res.json()) as { id?: string; url?: string };
    if (!json.id || !json.url) throw new PaymentInitError('stripe');
    return { id: json.id, url: json.url };
  }
}
