'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MOMO_NETWORKS } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { useAdmin } from '@/lib/admin/store';
import { STATUS_META, customerName, type AdminOrder, type OrderStatus } from '@/lib/admin/types';
import { Card, PageHeader, StatusBadge, btnGhost, btnPrimary, fmtDateTime, inputClass } from '@/components/admin/ui';

/** The single most likely next step for each status. */
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; note?: string }>> = {
  pending_payment: { to: 'paid', label: 'Mark as paid', note: 'Payment confirmed manually' },
  paid: { to: 'processing', label: 'Start processing' },
  processing: { to: 'shipped', label: 'Mark as shipped' },
  shipped: { to: 'delivered', label: 'Mark as delivered' },
};
const CAN_CANCEL: OrderStatus[] = ['pending_payment', 'paid', 'processing'];
const CAN_REFUND: OrderStatus[] = ['paid', 'processing', 'shipped', 'delivered'];

function Address({ order }: { order: AdminOrder }) {
  const a = order.address;
  const lines =
    'postcode' in a
      ? [customerName(order), a.line1, a.line2, a.city, a.postcode.toUpperCase(), 'United Kingdom', a.phone]
      : [customerName(order), a.area, a.city, a.region, a.digitalAddress?.toUpperCase(), 'Ghana', a.phone];
  return <address className="text-sm not-italic leading-relaxed">{lines.filter(Boolean).map((l) => <span key={l} className="block">{l}</span>)}</address>;
}

export default function OrderDetail() {
  const { number } = useParams<{ number: string }>();
  const { orders, setOrderStatus } = useAdmin();
  const [note, setNote] = useState('');
  const order = orders.find((o) => o.number === number);

  if (!order) {
    return (
      <>
        <PageHeader title="Order not found" />
        <Link href="/admin/orders" className="underline">Back to orders</Link>
      </>
    );
  }

  const money = (n: number) => formatMoney(n, order.currency);
  const next = NEXT[order.status];
  const apply = (to: OrderStatus, defaultNote?: string) => {
    setOrderStatus(order.number, to, note.trim() || defaultNote);
    setNote('');
  };
  const p = order.payment;
  const network = p.method === 'momo' ? MOMO_NETWORKS.find((n) => n.id === p.network)?.label : undefined;

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-block text-sm text-muted hover:text-ink">← Orders</Link>
      <PageHeader
        title={`Order ${order.number}`}
        subtitle={`Placed ${fmtDateTime(order.createdAt)} · ${order.region === 'UK' ? 'United Kingdom' : 'Ghana'}`}
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Items">
            <ul className="divide-y divide-line">
              {order.lines.map((l) => (
                <li key={l.slug} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span>{l.name}<span className="block text-xs text-muted">{money(l.unitPrice)} × {l.qty}</span></span>
                  <span>{money(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line px-5 py-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>{order.shipping.label}</dt><dd>{order.shipping.cost === 0 ? 'Free' : money(order.shipping.cost)}</dd></div>
              <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
            </dl>
          </Card>

          <Card title="Timeline">
            <ol className="space-y-4 px-5 py-4">
              {[...order.history].reverse().map((h, i) => (
                <li key={`${h.status}-${h.at}`} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${i === 0 ? 'bg-brand' : 'bg-line'}`} aria-hidden />
                  <span>
                    <span className="font-medium">{STATUS_META[h.status].label}</span>
                    <span className="block text-xs text-muted">{fmtDateTime(h.at)}</span>
                    {h.note && <span className="mt-0.5 block text-muted">{h.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Fulfilment">
            <div className="space-y-3 p-5">
              {next || CAN_CANCEL.includes(order.status) || CAN_REFUND.includes(order.status) ? (
                <>
                  <label className="block text-xs text-muted" htmlFor="note">
                    Note {order.status === 'processing' && '(e.g. tracking number)'}
                  </label>
                  <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={inputClass} />
                  {next && <button type="button" className={`${btnPrimary} w-full`} onClick={() => apply(next.to, next.note)}>{next.label}</button>}
                  <div className="flex gap-2">
                    {CAN_CANCEL.includes(order.status) && (
                      <button type="button" className={`${btnGhost} flex-1`} onClick={() => confirm('Cancel this order?') && apply('cancelled')}>Cancel</button>
                    )}
                    {CAN_REFUND.includes(order.status) && (
                      <button type="button" className={`${btnGhost} flex-1`} onClick={() => confirm(`Mark ${money(order.total)} as refunded? This does not move any money yet.`) && apply('refunded')}>Refund</button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">No further actions for this order.</p>
              )}
            </div>
          </Card>

          <Card title="Customer">
            <div className="space-y-1 p-5 text-sm">
              <p className="font-medium">{customerName(order)}</p>
              <a href={`mailto:${order.email}`} className="text-muted underline">{order.email}</a>
            </div>
          </Card>
          <Card title="Delivery address"><div className="p-5"><Address order={order} /></div></Card>
          <Card title="Payment">
            <div className="space-y-1 p-5 text-sm">
              <p>{p.method === 'momo' ? `Mobile Money · ${network}` : order.region === 'UK' ? 'Card (Stripe)' : 'Card (Paystack)'}</p>
              {p.method === 'momo' && <p className="text-muted">{p.phone}</p>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
