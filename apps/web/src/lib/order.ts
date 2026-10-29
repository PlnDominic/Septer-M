import type { CheckoutData, Currency, Region } from '@septer-m/shared';

export interface OrderLine {
  slug: string;
  name: string;
  qty: number;
  /** Minor units at time of purchase. */
  unitPrice: number;
}

/** Client-side order record until the API exists. */
export interface Order {
  number: string;
  createdAt: string;
  region: Region;
  currency: Currency;
  email: string;
  address: CheckoutData['address'];
  payment: CheckoutData['payment'];
  shipping: { id: string; label: string; detail: string; cost: number };
  lines: OrderLine[];
  subtotal: number;
  total: number;
}

const KEY = 'sm.lastOrder';

export const newOrderNumber = () => `SM-${Date.now().toString(36).toUpperCase()}`;

export function saveLastOrder(order: Order) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* storage unavailable */
  }
}

export function loadLastOrder(): Order | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}
