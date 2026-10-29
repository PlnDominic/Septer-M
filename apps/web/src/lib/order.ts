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

export const newOrderNumber = () => `SM-${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`;

/** Orders placed in this browser, picked up by the admin demo until the API exists. */
export const PLACED_KEY = 'sm.placedOrders';

export function saveLastOrder(order: Order) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(order));
    const placed = JSON.parse(localStorage.getItem(PLACED_KEY) ?? '[]') as Order[];
    localStorage.setItem(PLACED_KEY, JSON.stringify([order, ...placed].slice(0, 50)));
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
