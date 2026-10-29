'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MOMO_NETWORKS } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { loadLastOrder, type Order } from '@/lib/order';

function AddressLines({ order }: { order: Order }) {
  const a = order.address;
  const lines =
    'postcode' in a
      ? [`${a.firstName} ${a.lastName}`, a.line1, a.line2, a.city, a.postcode.toUpperCase(), 'United Kingdom', a.phone]
      : [`${a.firstName} ${a.lastName}`, a.area, a.city, a.region, a.digitalAddress?.toUpperCase(), 'Ghana', a.phone];
  return <>{lines.filter(Boolean).map((l) => <span key={l} className="block">{l}</span>)}</>;
}

export default function ConfirmationPage() {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  useEffect(() => setOrder(loadLastOrder()), []);

  if (order === undefined) return null;
  if (order === null) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-3xl">No recent order</h1>
        <Link href="/shop" className="mt-6 inline-block underline">Continue shopping</Link>
      </div>
    );
  }

  const money = (n: number) => formatMoney(n, order.currency);
  const p = order.payment;
  const network = p.method === 'momo' ? MOMO_NETWORKS.find((n) => n.id === p.network)?.label : undefined;

  return (
    <div className="mx-auto max-w-3xl py-12">
      <div role="note" className="mb-8 rounded-xl border border-brand bg-brand/10 px-4 py-3 text-sm">
        <strong>Test mode:</strong> payments are not connected yet, so no money was taken and this order was not sent to the shop.
      </div>

      <p className="flex items-center gap-2 text-sm font-semibold tracking-widest uppercase">
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />Order placed
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Thank you, {order.address.firstName}!</h1>
      <p className="mt-3 text-muted">
        Order <strong className="text-ink">{order.number}</strong>. A confirmation will be sent to {order.email}.
      </p>

      <div className="mt-8 rounded-2xl bg-mist p-5 text-sm">
        <h2 className="text-base">What happens next</h2>
        <p className="mt-2 text-muted">
          {p.method === 'momo'
            ? `You'll receive a payment prompt from ${network} on ${p.phone}. Approve it with your PIN to complete payment.`
            : `You'll be taken to a secure ${order.region === 'UK' ? 'Stripe' : 'Paystack'} page to pay by card.`}{' '}
          We'll email you when your order ships.
        </p>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-line p-5 text-sm">
          <h2 className="mb-2 text-base">Delivery to</h2>
          <AddressLines order={order} />
          <p className="mt-3 text-muted">{order.shipping.label} · {order.shipping.detail}</p>
        </div>
        <div className="rounded-2xl border border-line p-5 text-sm">
          <h2 className="mb-2 text-base">Payment</h2>
          <p>{p.method === 'momo' ? `Mobile Money · ${network}` : order.region === 'UK' ? 'Card, Apple Pay or Google Pay' : 'Card'}</p>
          {p.method === 'momo' && <p className="text-muted">{p.phone}</p>}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line p-5 text-sm">
        <h2 className="mb-3 text-base">Items</h2>
        <ul className="space-y-2">
          {order.lines.map((l) => (
            <li key={l.slug} className="flex justify-between gap-4">
              <span>{l.name} × {l.qty}</span>
              <span>{money(l.unitPrice * l.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-line pt-3">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{order.shipping.cost === 0 ? 'Free' : money(order.shipping.cost)}</dd></div>
          <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      </div>

      <Link href="/shop" className="mt-8 inline-block rounded-full bg-ink px-7 py-3 font-medium text-white transition hover:bg-brand hover:text-ink">
        Continue shopping
      </Link>
    </div>
  );
}
