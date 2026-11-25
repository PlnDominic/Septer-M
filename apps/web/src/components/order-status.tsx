import type { ServerOrder } from '@/lib/api';

type Status = ServerOrder['status'];

export const STATUS_LABEL: Record<Status, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  processing: 'Being prepared',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const STATUS_TEXT: Record<Status, string> = {
  pending_payment: 'We’re waiting for your payment.',
  paid: 'We’ve got your payment and will start preparing your order.',
  processing: 'We’re packing your order.',
  shipped: 'Your order is on its way.',
  delivered: 'Your order has been delivered.',
  cancelled: 'This order was cancelled.',
  refunded: 'This order was refunded.',
};

const TONE: Record<Status, string> = {
  pending_payment: 'bg-amber-100 text-amber-900',
  paid: 'bg-green-100 text-green-900',
  processing: 'bg-green-100 text-green-900',
  shipped: 'bg-blue-100 text-blue-900',
  delivered: 'bg-green-100 text-green-900',
  cancelled: 'bg-red-100 text-red-900',
  refunded: 'bg-red-100 text-red-900',
};

export function OrderStatusBadge({ status }: { status: Status }) {
  return <span data-testid="order-status" className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
