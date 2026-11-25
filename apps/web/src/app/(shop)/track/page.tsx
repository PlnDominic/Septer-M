'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, apiEnabled, ApiError, orderErrorMessage, type ServerOrder } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { OrderStatusBadge, STATUS_LABEL, STATUS_TEXT } from '@/components/order-status';
import { TextField } from '@/components/checkout/fields';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Result({ order }: { order: ServerOrder }) {
  const money = (n: number) => formatMoney(n, order.currency);
  return (
    <section aria-label={`Order ${order.number}`} className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl">Order {order.number}</h2>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="text-sm text-muted">{STATUS_TEXT[order.status]}</p>

      <ol className="space-y-3 border-l-2 border-line pl-5 text-sm">
        {order.history.map((h, i) => (
          <li key={`${h.status}-${h.at}-${i}`} className="relative">
            <span className="absolute top-1.5 -left-[27px] h-3 w-3 rounded-full bg-brand" aria-hidden />
            <p className="font-medium">{STATUS_LABEL[h.status]}</p>
            <p className="text-muted">{fmt(h.at)}</p>
            {h.note && <p className="mt-0.5">{h.note}</p>}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-line p-5 text-sm">
        <ul className="space-y-2">
          {order.lines.map((l) => (
            <li key={l.slug} className="flex justify-between gap-4"><span>{l.name} × {l.qty}</span><span>{money(l.unitPrice * l.qty)}</span></li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-line pt-3">
          {order.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{money(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery ({order.shipping.label})</dt><dd>{order.shipping.cost === 0 ? 'Free' : money(order.shipping.cost)}</dd></div>
          <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function Tracker() {
  const params = useSearchParams();
  const linkOrder = params.get('order');
  const linkToken = params.get('token');
  const [number, setNumber] = useState(linkOrder ?? '');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<ServerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A link from our emails carries the order's secret token, so no email is needed.
  useEffect(() => {
    if (!apiEnabled || !linkOrder || !linkToken) return;
    setBusy(true);
    api<ServerOrder>(`/orders/${encodeURIComponent(linkOrder)}?token=${encodeURIComponent(linkToken)}`)
      .then(setOrder)
      .catch(() => setError('We couldn’t open that tracking link. Try your order number and email instead.'))
      .finally(() => setBusy(false));
  }, [linkOrder, linkToken]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setBusy(true);
    try {
      setOrder(await api<ServerOrder>('/orders/track', { body: { number: number.trim(), email: email.trim() } }));
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'ORDER_NOT_FOUND' ? err.message : orderErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-12">
      <h1 className="text-3xl sm:text-4xl">Track your order</h1>
      <p className="mt-3 text-muted">Enter your order number and the email you used at checkout. Signed in? <Link href="/account" className="underline">Your orders</Link> are on your account page.</p>

      {!apiEnabled ? (
        <p className="mt-8 rounded-xl bg-mist p-4 text-sm">Order tracking isn’t available until the shop is connected. For now, please <Link href="/contact" className="underline">contact us</Link>.</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          <TextField id="track-number" label="Order number" placeholder="SM-1042" value={number} onChange={(e) => setNumber(e.target.value)} />
          <TextField id="track-email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy || !number.trim() || !email.trim()} className="h-12 w-full rounded-full bg-ink font-medium text-white transition hover:bg-brand hover:text-ink disabled:opacity-50">
            {busy ? 'Looking…' : 'Track order'}
          </button>
        </form>
      )}

      {busy && !order && linkToken && <p className="mt-6 text-muted">Opening your order…</p>}
      {order && <Result order={order} />}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
