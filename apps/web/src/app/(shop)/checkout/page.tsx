'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GH_REGIONS,
  MOMO_NETWORKS,
  checkoutSchema,
  estimateArrival,
  shippingCost,
  shippingOptions,
  type MomoNetwork,
  type Region,
} from '@septer-m/shared';
import { getProduct } from '@/lib/products';
import { api, apiEnabled, ApiError, orderErrorMessage, type PlacedOrder } from '@/lib/api';
import { checkPostcode, type PostcodeCheck } from '@/lib/postcode';
import { formatMoney } from '@/lib/money';
import { newOrderNumber, saveLastOrder, type Order } from '@/lib/order';
import { useAuth } from '@/components/auth-provider';
import { useShop } from '@/components/providers';
import { formatArrival, useNow } from '@/lib/delivery-format';
import { RETURN_DAYS } from '@/lib/site';
import { ProductVisual } from '@/components/product-visual';
import { Choice, Section, SelectField, TextField } from '@/components/checkout/fields';
import { LockIcon } from '@/components/icons';

const emptyUk = { firstName: '', lastName: '', line1: '', line2: '', city: '', postcode: '', phone: '' };
const emptyGh = { firstName: '', lastName: '', phone: '', region: '', city: '', area: '', digitalAddress: '' };

type Errors = Record<string, string>;

export default function CheckoutPage() {
  const router = useRouter();
  const { ready, lines, region, setRegion, currency, clear, stockOf } = useShop();
  const [email, setEmail] = useState('');
  const [uk, setUk] = useState(emptyUk);
  const [gh, setGh] = useState(emptyGh);
  const [shippingId, setShippingId] = useState('');
  const [payMethod, setPayMethod] = useState<'card' | 'momo'>('momo');
  const [network, setNetwork] = useState<MomoNetwork | ''>('');
  const [momoPhone, setMomoPhone] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [placing, setPlacing] = useState(false);
  const { user, profile, configured, session } = useAuth();
  const now = useNow();
  const [draftLoaded, setDraftLoaded] = useState(false);
  const prefilledEmail = useRef(false);
  const prefilledName = useRef(false);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; discount: number; description?: string } | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [pcCheck, setPcCheck] = useState<PostcodeCheck>(null);

  // Bring back a half-finished form after a reload (this tab only; payment details are never saved).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sm.checkoutDraft');
      if (raw) {
        const d = JSON.parse(raw) as { email?: string; uk?: Partial<typeof emptyUk>; gh?: Partial<typeof emptyGh>; shippingId?: string };
        setEmail(d.email ?? '');
        setUk({ ...emptyUk, ...d.uk });
        setGh({ ...emptyGh, ...d.gh });
        if (d.shippingId) setShippingId(d.shippingId);
      }
    } catch {
      /* ignore a corrupt draft */
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    setCancelled(new URLSearchParams(window.location.search).get('payment') === 'cancelled');
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      sessionStorage.setItem('sm.checkoutDraft', JSON.stringify({ email, uk, gh, shippingId }));
    } catch {
      /* storage unavailable */
    }
  }, [draftLoaded, email, uk, gh, shippingId]);

  // Signed-in customers don't retype what we already know.
  useEffect(() => {
    if (!draftLoaded || !user) return;
    if (!prefilledEmail.current) {
      prefilledEmail.current = true;
      setEmail((e) => e || user.email || '');
    }
    const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
    const full = profile?.fullName ?? meta?.full_name ?? meta?.name ?? '';
    if (!prefilledName.current && (profile || full)) {
      prefilledName.current = true;
      const [first, ...rest] = full.trim().split(/\s+/);
      if (first) {
        setUk((u) => ({ ...u, firstName: u.firstName || first, lastName: u.lastName || rest.join(' ') }));
        setGh((g) => ({ ...g, firstName: g.firstName || first, lastName: g.lastName || rest.join(' ') }));
      }
    }
  }, [draftLoaded, user, profile]);

  const rows = lines.flatMap((l) => {
    const product = getProduct(l.slug);
    return product ? [{ product, qty: l.qty }] : [];
  });
  const subtotal = rows.reduce((sum, r) => sum + r.product.price[currency] * r.qty, 0);
  const options = shippingOptions(region, gh.region);
  const shipping = options.find((o) => o.id === shippingId) ?? options[0];
  const delivery = shippingCost(shipping, subtotal);
  const discount = Math.min(promo?.discount ?? 0, subtotal);
  const total = subtotal - discount + delivery;
  const soldOutRows = rows.filter((r) => stockOf(r.product.slug).soldOut);
  const method = region === 'UK' ? 'card' : payMethod;
  const money = (n: number) => formatMoney(n, currency);

  const bagKey = rows.map((r) => `${r.product.slug}:${r.qty}`).join(',');
  const applyPromo = async (code: string, silent = false) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setPromoBusy(true);
    try {
      const res = await api<{ valid: boolean; code?: string; discount: number; description?: string; reason?: string; min?: number }>('/promo/validate', {
        body: { code: trimmed, email: email || undefined, region, items: rows.map((r) => ({ slug: r.product.slug, qty: r.qty })) },
      });
      if (res.valid) {
        setPromo({ code: res.code ?? trimmed.toUpperCase(), discount: res.discount, description: res.description });
        setPromoMsg({ kind: 'ok', text: `${res.code ?? trimmed.toUpperCase()} applied` });
      } else {
        setPromo(null);
        setPromoMsg({ kind: 'error', text: promoReason(res.reason, res.min, currency) });
      }
    } catch (e) {
      if (!silent) setPromoMsg({ kind: 'error', text: orderErrorMessage(e) });
    } finally {
      setPromoBusy(false);
    }
  };

  // A code's value depends on the bag, the country and (for first-order codes) the email, so re-check when they change.
  const promoCode = promo?.code;
  useEffect(() => {
    if (!promoCode) return;
    const t = setTimeout(() => void applyPromo(promoCode, true), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagKey, region, email, promoCode]);

  const ukPostcode = uk.postcode;
  useEffect(() => {
    setPcCheck(null);
    if (region !== 'UK') return;
    const ctrl = new AbortController();
    const t = setTimeout(() => void checkPostcode(ukPostcode, ctrl.signal).then(setPcCheck), 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [ukPostcode, region]);

  if (placing) return <p className="py-24 text-center text-muted">Placing your order…</p>;
  if (!ready) return <p className="py-24 text-center text-muted">Loading your bag…</p>;
  if (rows.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-3xl">Your bag is empty</h1>
        <Link href="/shop" className="mt-6 inline-block rounded-full bg-ink px-7 py-3 font-medium text-white hover:bg-brand hover:text-ink">
          Continue shopping
        </Link>
      </div>
    );
  }

  const err = (key: string) => errors[key];
  const ukField = (key: keyof typeof emptyUk) => ({
    id: `address.${key}`,
    value: uk[key],
    error: err(`address.${key}`),
    onChange: (e: { target: { value: string } }) => setUk({ ...uk, [key]: e.target.value }),
  });
  const ghField = (key: keyof typeof emptyGh) => ({
    id: `address.${key}`,
    value: gh[key],
    error: err(`address.${key}`),
    onChange: (e: { target: { value: string } }) => setGh({ ...gh, [key]: e.target.value }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input =
      region === 'UK'
        ? { region, email, address: uk, shippingId: shipping.id, payment: { method: 'card' as const } }
        : {
            region,
            email,
            address: gh,
            shippingId: shipping.id,
            payment: method === 'momo' ? { method: 'momo' as const, network, phone: momoPhone } : { method: 'card' as const },
          };

    const result = checkoutSchema.safeParse(input);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.');
        next[key] ??= issue.message;
      }
      setErrors(next);
      const first = Object.keys(next)[0];
      document.getElementById(first)?.focus();
      return;
    }

    if (soldOutRows.length > 0) {
      setSubmitError(`${soldOutRows[0].product.name} is sold out. Please remove it from your bag to continue.`);
      return;
    }
    if (apiEnabled && promoInput.trim() && !promo) {
      setPromoMsg({ kind: 'error', text: 'Press Apply to use this code, or clear the box.' });
      document.getElementById('promo')?.focus();
      return;
    }

    if (apiEnabled) {
      void placeWithApi(result.data);
      return;
    }

    const order: Order = {
      number: newOrderNumber(),
      createdAt: new Date().toISOString(),
      region,
      currency,
      email: result.data.email,
      address: result.data.address,
      payment: result.data.payment,
      shipping: { id: shipping.id, label: shipping.label, detail: shipping.detail, cost: delivery },
      lines: rows.map(({ product, qty }) => ({ slug: product.slug, name: product.name, qty, unitPrice: product.price[currency] })),
      subtotal,
      total,
    };
    setPlacing(true);
    saveLastOrder(order);
    try {
      sessionStorage.removeItem('sm.checkoutDraft');
    } catch {
      /* nothing to clear */
    }
    clear();
    router.push('/checkout/confirmation');
  };

  /** Sends the order to the shop, then to wherever the shopper pays (hosted card page, or a prompt on their phone). */
  const placeWithApi = async (data: ReturnType<typeof checkoutSchema.parse>) => {
    setPlacing(true);
    setSubmitError(null);
    try {
      const placed = await api<PlacedOrder>('/orders', {
        body: { items: rows.map((r) => ({ slug: r.product.slug, qty: r.qty })), checkout: data, promoCode: promo?.code },
        token: session?.access_token,
      });
      try {
        sessionStorage.setItem('sm.pay', JSON.stringify({ number: placed.number, payment: placed.payment }));
        sessionStorage.removeItem('sm.checkoutDraft');
      } catch {
        /* the confirmation page can still read the order from the server */
      }
      // The bag is emptied on the confirmation page once the order is paid, so coming back from a cancelled card payment keeps it.
      if (placed.payment.action === 'redirect') {
        window.location.assign(placed.payment.url);
        return;
      }
      router.push(`/checkout/confirmation?order=${encodeURIComponent(placed.number)}&token=${encodeURIComponent(placed.token)}`);
    } catch (e) {
      setPlacing(false);
      setSubmitError(orderErrorMessage(e));
      if (e instanceof ApiError && e.code === 'PROMO_INVALID') {
        setPromo(null);
        setPromoMsg({ kind: 'error', text: e.message });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const summaryBody = (
    <>
      <ul className="space-y-4">
        {rows.map(({ product, qty }) => (
          <li key={product.slug} className="flex items-center gap-3">
            <div className="relative w-14 shrink-0">
              <ProductVisual product={product} square sizes="56px" className="!rounded-lg" />
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] text-white">{qty}</span>
            </div>
            <span className="flex-1 text-sm">{product.name}</span>
            <span className="text-sm">{money(product.price[currency] * qty)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
        {discount > 0 && <div className="flex justify-between text-green-700"><dt>Discount ({promo?.code})</dt><dd>−{money(discount)}</dd></div>}
        <div className="flex justify-between">
          <dt>Delivery</dt>
          <dd>{region === 'GH' && !gh.region ? 'Choose your region' : delivery === 0 ? 'Free' : money(delivery)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd>{money(total)}</dd></div>
      </dl>
    </>
  );

  return (
    <div className="pt-8 pb-28 lg:py-10">
      <h1 className="text-3xl sm:text-4xl">Checkout</h1>
      {user ? (
        <p className="mt-2 text-sm text-muted">Signed in as {user.email}</p>
      ) : (
        configured && (
          <p className="mt-2 text-sm text-muted">
            Have an account? <Link href="/account?next=/checkout" className="underline">Sign in</Link> to fill in your details, or continue as a guest.
          </p>
        )
      )}

      {cancelled && (
        <p role="status" className="mt-4 rounded-xl border border-line bg-mist px-4 py-3 text-sm">
          Your payment wasn’t completed and you haven’t been charged. Your bag is still here whenever you’re ready.
        </p>
      )}
      {submitError && (
        <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {submitError} <Link href="/cart" className="underline">Review bag</Link>
        </p>
      )}
      {soldOutRows.length > 0 && !submitError && (
        <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {soldOutRows[0].product.name} is sold out. <Link href="/cart" className="underline">Remove it from your bag</Link> to continue.
        </p>
      )}

      {/* Phones: the order and its total sit at the top, collapsed by default. */}
      <details className="mt-6 rounded-2xl border border-line lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>Order summary ({rows.reduce((n, r) => n + r.qty, 0)} {rows.reduce((n, r) => n + r.qty, 0) === 1 ? 'item' : 'items'})</span>
          <span>{money(total)}</span>
        </summary>
        <div className="space-y-5 border-t border-line p-4">{summaryBody}</div>
      </details>

      <form id="checkout-form" onSubmit={submit} noValidate className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section step={1} title="Contact">
            <TextField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={err('email')}
              hint="We'll send your order confirmation here."
            />
          </Section>

          <Section step={2} title="Delivery address">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <SelectField
                  id="country"
                  label="Country"
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value as Region);
                    setErrors({});
                  }}
                >
                  <option value="UK">United Kingdom (prices in £)</option>
                  <option value="GH">Ghana (prices in GH₵)</option>
                </SelectField>
              </div>

              {region === 'UK' ? (
                <>
                  <TextField label="First name" autoComplete="given-name" {...ukField('firstName')} />
                  <TextField label="Last name" autoComplete="family-name" {...ukField('lastName')} />
                  <div className="sm:col-span-2"><TextField label="Address line 1" autoComplete="address-line1" {...ukField('line1')} /></div>
                  <div className="sm:col-span-2"><TextField label="Address line 2" optional autoComplete="address-line2" {...ukField('line2')} /></div>
                  <TextField label="Town or city" autoComplete="address-level2" {...ukField('city')} />
                  <TextField
                    label="Postcode"
                    autoComplete="postal-code"
                    className="uppercase"
                    hint={pcCheck?.found ? `✓ ${pcCheck.area}` : pcCheck && !pcCheck.found ? 'We couldn’t find this postcode. Please double-check it.' : undefined}
                    {...ukField('postcode')}
                  />
                  <div className="sm:col-span-2">
                    <TextField label="Phone" optional type="tel" autoComplete="tel" hint="For delivery updates." {...ukField('phone')} />
                  </div>
                </>
              ) : (
                <>
                  <TextField label="First name" autoComplete="given-name" {...ghField('firstName')} />
                  <TextField label="Last name" autoComplete="family-name" {...ghField('lastName')} />
                  <div className="sm:col-span-2">
                    <TextField label="Phone" type="tel" autoComplete="tel" placeholder="024 123 4567" hint="The rider will call this number." {...ghField('phone')} />
                  </div>
                  <SelectField label="Region" {...ghField('region')}>
                    <option value="">Select region</option>
                    {GH_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </SelectField>
                  <TextField label="Town or city" autoComplete="address-level2" {...ghField('city')} />
                  <div className="sm:col-span-2">
                    <TextField label="Area and landmark" placeholder="e.g. East Legon, near A&C Mall" {...ghField('area')} />
                  </div>
                  <div className="sm:col-span-2">
                    <TextField label="Digital address (GhanaPostGPS)" optional placeholder="GA-123-4567" className="uppercase" {...ghField('digitalAddress')} />
                  </div>
                </>
              )}
            </div>
          </Section>

          <Section step={3} title="Delivery method">
            {region === 'GH' && !gh.region ? (
              <p className="text-sm text-muted">Choose your region above to see delivery options.</p>
            ) : (
              <div className="space-y-3">
                {options.map((o) => {
                  const cost = shippingCost(o, subtotal);
                  return (
                    <Choice
                      key={o.id}
                      name="shipping"
                      checked={shipping.id === o.id}
                      onChange={() => setShippingId(o.id)}
                      title={o.label}
                      detail={now ? `${o.detail} · arrives ${formatArrival(estimateArrival(now, o.minDays, o.maxDays))}` : o.detail}
                      aside={cost === 0 ? 'Free' : money(cost)}
                    />
                  );
                })}
              </div>
            )}
          </Section>

          <Section step={4} title="Payment">
            {region === 'UK' ? (
              <div className="space-y-3">
                <Choice name="payment" checked onChange={() => {}} title="Card, Apple Pay or Google Pay" detail="Processed securely by Stripe" />
                <p className="text-xs text-muted">You'll enter your card details on a secure payment page after placing your order.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Choice name="payment" checked={method === 'momo'} onChange={() => setPayMethod('momo')} title="Mobile Money" detail="MTN MoMo, Telecel Cash or AirtelTigo Money" />
                {method === 'momo' && (
                  <div className="grid gap-4 rounded-xl bg-mist p-4 sm:grid-cols-2">
                    <SelectField id="payment.network" label="Network" value={network} error={err('payment.network')} onChange={(e) => setNetwork(e.target.value as MomoNetwork)}>
                      <option value="">Select network</option>
                      {MOMO_NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </SelectField>
                    <TextField
                      id="payment.phone"
                      label="Mobile Money number"
                      type="tel"
                      placeholder="024 123 4567"
                      value={momoPhone}
                      error={err('payment.phone')}
                      onChange={(e) => setMomoPhone(e.target.value)}
                    />
                    <p className="text-xs text-muted sm:col-span-2">You'll get a prompt on your phone to approve the payment with your PIN.</p>
                  </div>
                )}
                <Choice name="payment" checked={method === 'card'} onChange={() => setPayMethod('card')} title="Card" detail="Visa or Mastercard, processed by Paystack" />
              </div>
            )}
          </Section>

          {apiEnabled && (
            <div className="rounded-2xl border border-line p-5">
              <label htmlFor="promo" className="text-sm font-medium">Discount code</label>
              <div className="mt-2 flex gap-2">
                <input
                  id="promo"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value);
                    if (promo) setPromo(null);
                    setPromoMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void applyPromo(promoInput);
                    }
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 uppercase"
                  placeholder="Enter code"
                />
                <button
                  type="button"
                  disabled={promoBusy || !promoInput.trim()}
                  onClick={() => void applyPromo(promoInput)}
                  className="h-11 rounded-xl bg-ink px-5 text-sm font-medium text-white transition hover:bg-brand hover:text-ink disabled:opacity-50"
                >
                  {promoBusy ? 'Checking…' : 'Apply'}
                </button>
              </div>
              {promoMsg && (
                <p role={promoMsg.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${promoMsg.kind === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
                  {promoMsg.text}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted">
            By placing your order you agree to our <Link href="/terms" className="underline">Terms &amp; conditions</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>, and
            to our {RETURN_DAYS}-day <Link href="/returns" className="underline">returns policy</Link>.
          </p>
        </div>

        <aside className="hidden h-fit space-y-5 rounded-2xl border border-line p-5 sm:p-6 lg:sticky lg:top-24 lg:block">
          <h2 className="text-lg">Order summary</h2>
          {summaryBody}
          <p className="text-xs text-muted">Prices include VAT where applicable.</p>
          <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-medium text-white transition hover:bg-brand hover:text-ink">
            <LockIcon width={18} height={18} /> Place order · {money(total)}
          </button>
          <Link href="/cart" className="block text-center text-sm text-muted underline">Back to bag</Link>
        </aside>
      </form>

      {/* Phones: the total and the Place order button stay on screen while you fill in the form. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.08)] lg:hidden">
        <div className="min-w-0">
          <p className="text-xs text-muted">Total</p>
          <p className="text-lg leading-tight font-semibold">{money(total)}</p>
        </div>
        <button type="submit" form="checkout-form" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink font-medium text-white transition active:bg-brand active:text-ink">
          <LockIcon width={18} height={18} /> Place order
        </button>
      </div>
    </div>
  );
}

function promoReason(reason: string | undefined, min: number | undefined, currency: 'GBP' | 'GHS'): string {
  switch (reason) {
    case 'EXPIRED': return 'This code has expired.';
    case 'NOT_STARTED': return 'This code isn’t active yet.';
    case 'USED_UP': return 'This code has been fully used.';
    case 'INACTIVE': return 'This code isn’t active.';
    case 'FIRST_ORDER_ONLY': return 'This code is for first orders only.';
    case 'ALREADY_USED': return 'You’ve already used this code.';
    case 'EMAIL_REQUIRED': return 'Enter your email above first, then apply this code.';
    case 'MIN_SUBTOTAL': return min ? `Spend ${formatMoney(min, currency)} or more to use this code.` : 'Your bag doesn’t reach the minimum spend for this code.';
    default: return 'That code isn’t valid.';
  }
}
