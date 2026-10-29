export const CURRENCIES = ['GBP', 'GHS'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const REGIONS = ['UK', 'GH'] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_CURRENCY: Record<Region, Currency> = {
  UK: 'GBP',
  GH: 'GHS',
};

/** Money is always stored as integer minor units (pence / pesewas). */
export interface Money {
  amount: number;
  currency: Currency;
}

export const USER_ROLES = ['customer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export * from './checkout';
