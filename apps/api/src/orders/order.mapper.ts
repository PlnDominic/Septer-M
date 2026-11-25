import type { Currency, OrderStatus, Region } from '@septer-m/shared';

export interface OrderRow {
  number: string;
  user_id: string | null;
  email: string;
  region: Region;
  currency: Currency;
  status: OrderStatus;
  shipping_address: Record<string, unknown>;
  shipping_method_id: string;
  shipping_label: string;
  shipping_detail: string;
  shipping_cost: number;
  subtotal: number;
  total: number;
  payment: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
  items?: { slug: string; name: string; qty: number; unit_price: number }[];
  events?: { status: OrderStatus; note: string | null; created_at: string }[];
}

export const ORDER_SELECT =
  '*, items:order_items(slug, name, qty, unit_price), events:order_events(status, note, created_at)';

/** Public shape of an order. Never includes the guest token. */
export function toOrderDto(row: OrderRow) {
  return {
    number: row.number,
    status: row.status,
    region: row.region,
    currency: row.currency,
    email: row.email,
    address: row.shipping_address,
    payment: row.payment,
    shipping: { id: row.shipping_method_id, label: row.shipping_label, detail: row.shipping_detail, cost: row.shipping_cost },
    lines: (row.items ?? []).map((i) => ({ slug: i.slug, name: i.name, qty: i.qty, unitPrice: i.unit_price })),
    subtotal: row.subtotal,
    total: row.total,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    history: [...(row.events ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ status: e.status, at: e.created_at, note: e.note ?? undefined })),
  };
}
