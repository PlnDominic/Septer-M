import type { Currency } from '@septer-m/shared';

const LOCALE: Record<Currency, string> = { GBP: 'en-GB', GHS: 'en-GH' };

/** Amounts are integer minor units (pence / pesewas). */
export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], { style: 'currency', currency }).format(amount / 100);
}
