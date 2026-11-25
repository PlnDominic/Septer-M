import { Injectable, Logger } from '@nestjs/common';
import type { MomoNetwork } from '@septer-m/shared';
import { HttpService } from '../common/http.service';
import { getEnv } from '../config/env';
import { PaymentInitError, type PayableOrder } from './payments.types';

const API = 'https://api.paystack.co';

/** Paystack's code for each Ghana Mobile Money network. */
export const PAYSTACK_MOMO_PROVIDER: Record<MomoNetwork, string> = { mtn: 'mtn', telecel: 'vod', airteltigo: 'tgo' };

/** +233 24 123 4567 / 233241234567 / 024 123 4567 -> 0241234567 (the local format Paystack expects). */
export function toLocalGhPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  const m = /^(?:\+?233)(\d{9})$/.exec(digits);
  return m ? `0${m[1]}` : digits.replace(/^\+/, '');
}

/** Each attempt gets its own reference (Paystack never reuses one); the order number is the part before the dot. */
export const paystackReference = (orderNumber: string, now = Date.now()) => `${orderNumber}.${now.toString(36)}`;
export const orderNumberFromReference = (reference: string) => reference.split('.')[0];

export interface ChargeOutcome {
  status: 'pay_offline' | 'send_otp' | 'pending' | 'success' | 'failed' | string;
  reference: string;
  message: string;
}

@Injectable()
export class PaystackService {
  private readonly log = new Logger('Paystack');

  constructor(private readonly http: HttpService) {}

  private async call<T>(path: string, body: unknown): Promise<T> {
    const key = getEnv().PAYSTACK_SECRET_KEY;
    if (!key) throw new PaymentInitError('paystack');
    const res = await this.http.fetch(`${API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || json.status === false || !json.data) {
      this.log.error(`${path} refused (HTTP ${res.status}): ${json.message ?? 'no message'}`);
      throw new PaymentInitError('paystack', res.status);
    }
    return json.data;
  }

  /** Card payment on Paystack's hosted page. */
  async initializeCard(order: PayableOrder, webUrl: string): Promise<{ url: string; reference: string }> {
    const reference = paystackReference(order.number);
    const q = new URLSearchParams({ order: order.number, token: order.token });
    const data = await this.call<{ authorization_url: string }>('/transaction/initialize', {
      email: order.email,
      amount: order.total,
      currency: order.currency,
      reference,
      callback_url: `${webUrl}/checkout/confirmation?${q}`,
      channels: ['card'],
      metadata: { order_number: order.number },
    });
    return { url: data.authorization_url, reference };
  }

  /** Sends a payment prompt to the customer's phone. */
  async chargeMobileMoney(order: PayableOrder, network: MomoNetwork, phone: string): Promise<ChargeOutcome> {
    const reference = paystackReference(order.number);
    const data = await this.call<{ status: string; display_text?: string; reference?: string }>('/charge', {
      email: order.email,
      amount: order.total,
      currency: order.currency,
      reference,
      mobile_money: { phone: toLocalGhPhone(phone), provider: PAYSTACK_MOMO_PROVIDER[network] },
      metadata: { order_number: order.number },
    });
    return { status: data.status, reference: data.reference ?? reference, message: data.display_text ?? '' };
  }

  async submitOtp(reference: string, otp: string): Promise<ChargeOutcome> {
    const data = await this.call<{ status: string; display_text?: string; reference?: string }>('/charge/submit_otp', { otp, reference });
    return { status: data.status, reference: data.reference ?? reference, message: data.display_text ?? '' };
  }
}
