'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MOMO_NETWORKS } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { loadLastOrder, type Order } from '@/lib/order';
import { api, apiEnabled, ApiError, orderErrorMessage, type PaymentAction, type ServerOrder } from '@/lib/api';
import { useShop } from '@/components/providers';
import { OrderStatusBadge, STATUS_TEXT } from '@/components/order-status';

function AddressLines({ region, address }: { region: 'UK' | 'GH'; address: Record<string, string | undefined> }) {
  const a = address;
  const lines =
    region === 'UK'
      ? [`${a.firstName} ${a.lastName}`, a.line1, a.line2, a.city, a.postcode?.toUpperCase(), 'United Kingdom', a.phone]
      : [`${a.firstName} ${a.lastName}`, a.area, a.city, a.region, a.digitalAddress?.toUpperCase(), 'Ghana', a.phone];
  return <>{lines.filter(Boolean).map((l) => <span key={l} className="block">{l}</span>)}</>;
}

const PAID: ServerOrder['status'][] = ['paid', 'processing', 'shipped', 'delivered'];

/** The order as the shop knows it: polls until payment lands, and lets the shopper finish or retry paying. */
function LiveConfirmation({ number, token }: { number: string; token: string }) {
  const { clear } = useShop();
  const [order, setOrder] = useState<ServerOrder | null>(null);
  const [problem, setProblem] = useState<'notfound' | 'network' | null>(null);
  const [action, setAction] = useState<PaymentAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const cleared = useRef(false);

  // What the checkout page learnt when it placed the order (e.g. "approve on your phone").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sm.pay');
      if (raw) {
        const saved = JSON.parse(raw) as { number: string; payment: PaymentAction };
        if (saved.number === number) setAction(saved.payment);
      }
    } catch {
      /* nothing saved */
    }
  }, [number]);

  const load = useCallback(async () => {
    try {
      setOrder(await api<ServerOrder>(`/orders/${encodeURIComponent(number)}?token=${encodeURIComponent(token)}`));
      setProblem(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setProblem('notfound');
      else setProblem((p) => (order ? p : 'network'));
    }
  }, [number, token, order]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, token]);

  // Payment confirmations arrive from the payment provider a moment after the shopper pays, so keep checking.
  const pending = order?.status === 'pending_payment';
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [pending, load]);

  useEffect(() => {
    if (order && PAID.includes(order.status) && !cleared.current) {
      cleared.current = true;
      clear();
      try {
        sessionStorage.removeItem('sm.pay');
      } catch {
        /* ignore */
      }
    }
  }, [order, clear]);

  const act = async (path: string, body: unknown) => {
    setBusy(true);
    setPayError(null);
    try {
      const res = await api<{ payment: PaymentAction }>(path, { body });
      setAction(res.payment);
      if (res.payment.action === 'redirect') window.location.assign(res.payment.url);
      if (res.payment.action === 'error') setPayError(res.payment.message);
      setOtp('');
    } catch (e) {
      setPayError(orderErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const retry = () => void act(`/orders/${encodeURIComponent(number)}/payment`, { token });
  const submitOtp = (e: FormEvent) => {
    e.preventDefault();
    if (action?.action === 'momo_otp' && otp.trim()) {
      void act(`/orders/${encodeURIComponent(number)}/payment/otp`, { token, reference: action.reference, otp: otp.trim() });
    }
  };

  if (problem === 'notfound') {
    return (
      <div className="py-24 text-center">
        <h1 className="text-3xl">We couldn’t find that order</h1>
        <p className="mt-3 text-muted">The link may be incomplete. You can look your order up with its number and email.</p>
        <Link href="/track" className="mt-6 inline-block underline">Track an order</Link>
      </div>
    );
  }
  if (problem === 'network' && !order) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-3xl">Couldn’t load your order</h1>
        <p className="mt-3 text-muted">Check your connection. Your order is safe.</p>
        <button type="button" onClick={() => void load()} className="mt-6 rounded-full bg-ink px-7 py-3 font-medium text-white">Try again</button>
      </div>
    );
  }
  if (!order) return <p className="py-24 text-center text-muted">Loading your order…</p>;

  const money = (n: number) => formatMoney(n, order.currency);
  const paid = PAID.includes(order.status);
  const dead = order.status === 'cancelled' || order.status === 'refunded';
  const network = order.payment.method === 'momo' ? MOMO_NETWORKS.find((n) => n.id === order.payment.network)?.label : undefined;
  const first = order.address.firstName;

  return (
    <div className="mx-auto max-w-3xl py-12">
      {paid && (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold tracking-widest uppercase">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />Payment received
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Thank you, {first}!</h1>
          <p className="mt-3 text-muted">
            Order <strong className="text-ink">{order.number}</strong>. We’ve emailed a confirmation to {order.email}. We’ll email you again when it ships.
          </p>
        </>
      )}

      {pending && (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold tracking-widest uppercase">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden />Waiting for payment
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Almost there, {first}</h1>
          <p className="mt-3 text-muted">
            Order <strong className="text-ink">{order.number}</strong> is reserved for you while we wait for your payment. This page updates by itself.
          </p>

          <div className="mt-6 rounded-2xl bg-mist p-5 text-sm" aria-live="polite">
            {action?.action === 'momo_prompt' && (
              <>
                <h2 className="text-base">Approve the payment on your phone</h2>
                <p className="mt-2 text-muted">{action.message || `We’ve sent a prompt to ${order.payment.phone}. Enter your Mobile Money PIN to approve it.`}</p>
              </>
            )}
            {action?.action === 'momo_otp' && (
              <form onSubmit={submitOtp}>
                <h2 className="text-base">Enter the code we texted you</h2>
                <p className="mt-2 text-muted">{action.message}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    aria-label="One-time code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="h-11 w-40 rounded-xl border border-line bg-card px-3 tracking-widest"
                  />
                  <button type="submit" disabled={busy || !otp.trim()} className="h-11 rounded-xl bg-ink px-5 font-medium text-white disabled:opacity-50">
                    {busy ? 'Checking…' : 'Confirm'}
                  </button>
                </div>
              </form>
            )}
            {action?.action === 'none' && (
              <>
                <h2 className="text-base">Online payment isn’t switched on yet</h2>
                <p className="mt-2 text-muted">Your order is saved, but we can’t take payment through the website right now. Please contact us and quote your order number.</p>
              </>
            )}
            {(action === null || action.action === 'redirect' || action.action === 'error') && (
              <>
                <h2 className="text-base">{action?.action === 'error' ? 'We couldn’t start your payment' : 'Haven’t paid yet?'}</h2>
                <p className="mt-2 text-muted">
                  {action?.action === 'error'
                    ? action.message
                    : order.payment.method === 'momo'
                      ? `We’ll send a new prompt to ${order.payment.phone}${network ? ` (${network})` : ''}.`
                      : 'You’ll be taken to our secure payment page.'}
                </p>
                <button type="button" disabled={busy} onClick={retry} className="mt-3 rounded-full bg-ink px-6 py-2.5 font-medium text-white transition hover:bg-brand hover:text-ink disabled:opacity-50">
                  {busy ? 'Starting…' : order.payment.method === 'momo' ? 'Send the prompt again' : 'Pay now'}
                </button>
              </>
            )}
            {payError && action?.action !== 'error' && <p role="alert" className="mt-3 text-red-700">{payError}</p>}
            {order.expiresAt && <p className="mt-3 text-xs text-muted">Reserved until {new Date(order.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>}
          </div>
        </>
      )}

      {dead && (
        <>
          <h1 className="text-3xl sm:text-4xl">This order was {order.status === 'refunded' ? 'refunded' : 'cancelled'}</h1>
          <p className="mt-3 text-muted">Order {order.number}. If you didn’t pay, nothing was charged. Your items are back in the shop.</p>
          <Link href="/shop" className="mt-6 inline-block underline">Continue shopping</Link>
        </>
      )}

      <div className="mt-8 flex items-center gap-3 text-sm">
        <OrderStatusBadge status={order.status} />
        <span className="text-muted">{STATUS_TEXT[order.status]}</span>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-line p-5 text-sm">
          <h2 className="mb-2 text-base">Delivery to</h2>
          <AddressLines region={order.region} address={order.address} />
          <p className="mt-3 text-muted">{order.shipping.label} · {order.shipping.detail}</p>
        </div>
        <div className="rounded-2xl border border-line p-5 text-sm">
          <h2 className="mb-2 text-base">Payment</h2>
          <p>{order.payment.method === 'momo' ? `Mobile Money · ${network ?? ''}` : order.region === 'UK' ? 'Card, Apple Pay or Google Pay' : 'Card'}</p>
          {order.payment.method === 'momo' && <p className="text-muted">{order.payment.phone}</p>}
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
          {order.discount > 0 && <div className="flex justify-between text-green-700"><dt>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</dt><dd>−{money(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{order.shipping.cost === 0 ? 'Free' : money(order.shipping.cost)}</dd></div>
          <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      </div>

      <p className="mt-6 text-sm text-muted">
        Bookmark this page or use <Link href={`/track?order=${encodeURIComponent(order.number)}&token=${encodeURIComponent(token)}`} className="underline">your tracking link</Link> to check progress any time.
      </p>
      <Link href="/shop" className="mt-6 inline-block rounded-full bg-ink px-7 py-3 font-medium text-white transition hover:bg-brand hover:text-ink">
        Continue shopping
      </Link>
    </div>
  );
}

/** The old browser-only confirmation, used while the shop isn't connected to the API. */
function DemoConfirmation() {
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
          <AddressLines region={order.region} address={order.address as unknown as Record<string, string | undefined>} />
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

function Router() {
  const params = useSearchParams();
  const number = params.get('order');
  const token = params.get('token');
  if (apiEnabled && number && token) return <LiveConfirmation number={number} token={token} />;
  return <DemoConfirmation />;
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <Router />
    </Suspense>
  );
}
