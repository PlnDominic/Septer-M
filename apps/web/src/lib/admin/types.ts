import type { Product } from '@/lib/products';
import type { Order } from '@/lib/order';

export const ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Status badges always carry a text label; colour is a secondary cue. */
export const STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  pending_payment: { label: 'Awaiting payment', tone: 'bg-amber-100 text-amber-900' },
  paid: { label: 'Paid', tone: 'bg-blue-100 text-blue-900' },
  processing: { label: 'Processing', tone: 'bg-violet-100 text-violet-900' },
  shipped: { label: 'Shipped', tone: 'bg-sky-100 text-sky-900' },
  delivered: { label: 'Delivered', tone: 'bg-green-100 text-green-900' },
  cancelled: { label: 'Cancelled', tone: 'bg-neutral-200 text-neutral-700' },
  refunded: { label: 'Refunded', tone: 'bg-red-100 text-red-900' },
};

/** Orders that count towards revenue. */
export const REVENUE_STATUSES: OrderStatus[] = ['paid', 'processing', 'shipped', 'delivered'];
/** Orders the team needs to act on (pack and ship). */
export const TO_FULFIL: OrderStatus[] = ['paid', 'processing'];

export interface AdminOrder extends Order {
  status: OrderStatus;
  history: { status: OrderStatus; at: string; note?: string }[];
}

export interface AdminProduct extends Product {
  stock: number;
  status: 'active' | 'draft';
}

export const LOW_STOCK = 10;

export const customerName = (o: Order) => `${o.address.firstName} ${o.address.lastName}`;
