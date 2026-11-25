import type { Currency, MomoNetwork, Region } from '@septer-m/shared';

export interface PayableOrder {
  number: string;
  token: string;
  email: string;
  /** Minor units, after any discount and delivery. */
  total: number;
  currency: Currency;
  region: Region;
}

export type PaymentChoice = { method: 'card' } | { method: 'momo'; network: MomoNetwork; phone: string };

/** What the storefront should do next to collect the money. */
export type PaymentAction =
  | { action: 'redirect'; provider: 'stripe' | 'paystack'; url: string }
  | { action: 'momo_prompt'; network: MomoNetwork; reference: string; message: string }
  | { action: 'momo_otp'; network: MomoNetwork; reference: string; message: string }
  | { action: 'none'; reason: 'PAYMENTS_NOT_CONFIGURED' }
  | { action: 'error'; message: string };

export class PaymentInitError extends Error {
  constructor(
    readonly provider: 'stripe' | 'paystack',
    readonly status?: number,
  ) {
    super(`${provider} could not start the payment${status ? ` (HTTP ${status})` : ''}`);
  }
}
