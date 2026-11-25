import { Injectable, Logger } from '@nestjs/common';
import { getEnv } from '../config/env';
import { toHttpError } from '../common/db-errors';
import { OrderNotifier } from '../emails/order-notifier.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PaymentInitError, type PayableOrder, type PaymentAction, type PaymentChoice } from './payments.types';
import { orderNumberFromReference, PaystackService } from './paystack.service';
import { StripeService } from './stripe.service';

const ORDER_NUMBER = /^SM-\d{3,12}$/;

export interface WebhookResult {
  received: true;
  ignored?: string;
  result?: Record<string, unknown>;
}

@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
    private readonly paystack: PaystackService,
    private readonly notifier: OrderNotifier,
  ) {}

  /** Starts collecting payment for an order; says what the shopper has to do next. */
  async start(order: PayableOrder, choice: PaymentChoice): Promise<PaymentAction> {
    const env = getEnv();
    const web = env.WEB_URL;
    const uk = order.region === 'UK';
    if (!web || (uk ? !env.STRIPE_SECRET_KEY : !env.PAYSTACK_SECRET_KEY)) {
      return { action: 'none', reason: 'PAYMENTS_NOT_CONFIGURED' };
    }
    try {
      if (uk) {
        const s = await this.stripe.createCheckoutSession(order, web);
        return { action: 'redirect', provider: 'stripe', url: s.url };
      }
      if (choice.method === 'card') {
        const p = await this.paystack.initializeCard(order, web);
        return { action: 'redirect', provider: 'paystack', url: p.url };
      }
      const c = await this.paystack.chargeMobileMoney(order, choice.network, choice.phone);
      return this.momoAction(choice.network, c);
    } catch (e) {
      if (!(e instanceof PaymentInitError)) this.log.error(`Unexpected payment error for ${order.number}: ${(e as Error).message}`);
      return { action: 'error', message: 'We couldn’t start your payment. Nothing has been charged. Please try again.' };
    }
  }

  private momoAction(network: Extract<PaymentChoice, { method: 'momo' }>['network'], c: { status: string; reference: string; message: string }): PaymentAction {
    if (c.status === 'send_otp') {
      return { action: 'momo_otp', network, reference: c.reference, message: c.message || 'Enter the code sent to your phone to continue.' };
    }
    if (c.status === 'failed') return { action: 'error', message: 'Your Mobile Money payment was declined. Please check the number and try again.' };
    return { action: 'momo_prompt', network, reference: c.reference, message: c.message || 'Approve the payment on your phone with your PIN.' };
  }

  async submitMomoOtp(order: PayableOrder, network: Extract<PaymentChoice, { method: 'momo' }>['network'], reference: string, otp: string): Promise<PaymentAction> {
    if (orderNumberFromReference(reference) !== order.number) return { action: 'error', message: 'That payment does not belong to this order.' };
    try {
      return this.momoAction(network, await this.paystack.submitOtp(reference, otp));
    } catch {
      return { action: 'error', message: 'That code didn’t work. Please check it and try again.' };
    }
  }

  /* ---------- Webhooks (already signature-checked by the controller) ---------- */

  async handleStripeEvent(event: { type?: string; data?: { object?: Record<string, unknown> } }): Promise<WebhookResult> {
    const o = event.data?.object ?? {};
    const paid =
      (event.type === 'checkout.session.completed' && o.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded';
    if (!paid) return { received: true, ignored: event.type ?? 'unknown' };
    const number = (o.client_reference_id as string | undefined) ?? ((o.metadata as Record<string, string> | undefined)?.order_number);
    return this.markPaid('stripe', number, String(o.id ?? ''), o.amount_total, String(o.currency ?? '').toUpperCase());
  }

  async handlePaystackEvent(event: { event?: string; data?: Record<string, unknown> }): Promise<WebhookResult> {
    const d = event.data ?? {};
    if (event.event !== 'charge.success' || d.status !== 'success') return { received: true, ignored: event.event ?? 'unknown' };
    const reference = String(d.reference ?? '');
    const number = ((d.metadata as Record<string, string> | undefined)?.order_number) ?? orderNumberFromReference(reference);
    return this.markPaid('paystack', number, String(d.id ?? reference), d.amount, String(d.currency ?? '').toUpperCase());
  }

  private async markPaid(provider: 'stripe' | 'paystack', number: string | undefined, ref: string, amount: unknown, currency: string): Promise<WebhookResult> {
    if (!number || !ORDER_NUMBER.test(number) || !ref || !Number.isInteger(amount) || (currency !== 'GBP' && currency !== 'GHS')) {
      this.log.warn(`${provider} event ignored: unusable order reference, amount or currency`);
      return { received: true, ignored: 'unusable' };
    }
    const res = await this.supabase.admin.rpc('mark_order_paid', {
      p_order_number: number, p_provider: provider, p_provider_ref: ref, p_amount: amount, p_currency: currency, p_raw: { provider, ref },
    });
    if (res.error) {
      // An order we have never heard of can never succeed on retry, so acknowledge it; anything else should be retried.
      if (res.error.message === 'ORDER_NOT_FOUND') {
        this.log.warn(`${provider} payment for unknown order ${number}`);
        return { received: true, ignored: 'unknown-order' };
      }
      throw toHttpError(res.error);
    }
    const result = res.data as { status?: string; duplicate?: boolean; mismatch?: boolean; review?: boolean };
    if (result.mismatch || result.review) this.log.warn(`${provider} payment for ${number} needs review: ${JSON.stringify(result)}`);
    if (result.status === 'paid' && !result.duplicate && !result.mismatch && !result.review) void this.notifier.confirmed(number);
    return { received: true, result };
  }
}
