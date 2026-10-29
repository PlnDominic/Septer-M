'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GH_REGIONS,
  MOMO_NETWORKS,
  checkoutSchema,
  shippingCost,
  shippingOptions,
  type MomoNetwork,
  type Region,
} from '@septer-m/shared';
import { getProduct } from '@/lib/products';
import { formatMoney } from '@/lib/money';
import { newOrderNumber, saveLastOrder, type Order } from '@/lib/order';
import { useShop } from '@/components/providers';
import { ProductVisual } from '@/components/product-visual';
import { Choice, Section, SelectField, TextField } from '@/components/checkout/fields';
import { LockIcon } from '@/components/icons';

const emptyUk = { firstName: '', lastName: '', line1: '', line2: '', city: '', postcode: '', phone: '' };
const emptyGh = { firstName: '', lastName: '', phone: '', region: '', city: '', area: '', digitalAddress: '' };

type Errors = Record<string, string>;

export default function CheckoutPage() {
  const router = useRouter();
  const { ready, lines, region, setRegion, currency, clear } = useShop();
  const [email, setEmail] = useState('');
  const [uk, setUk] = useState(emptyUk);
  const [gh, setGh] = useState(emptyGh);
  const [shippingId, setShippingId] = useState('');
  const [payMethod, setPayMethod] = useState<'card' | 'momo'>('momo');
  const [network, setNetwork] = useState<MomoNetwork | ''>('');
  const [momoPhone, setMomoPhone] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [placing, setPlacing] = useState(false);

  const rows = lines.flatMap((l) => {
    const product = getProduct(l.slug);
    return product ? [{ product, qty: l.qty }] : [];
  });
  const subtotal = rows.reduce((sum, r) => sum + r.product.price[currency] * r.qty, 0);
  const options = shippingOptions(region, gh.region);
  const shipping = options.find((o) => o.id === shippingId) ?? options[0];
  const delivery = shippingCost(shipping, subtotal);
  const total = subtotal + delivery;
  const method = region === 'UK' ? 'card' : payMethod;
  const money = (n: number) => formatMoney(n, currency);

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
    clear();
    router.push('/checkout/confirmation');
  };

  return (
    <div className="py-10">
      <h1 className="text-3xl sm:text-4xl">Checkout</h1>
      <form onSubmit={submit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
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
                  <TextField label="Postcode" autoComplete="postal-code" className="uppercase" {...ukField('postcode')} />
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
                      detail={o.detail}
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
        </div>

        <aside className="h-fit space-y-5 rounded-2xl border border-line p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-lg">Order summary</h2>
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
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{region === 'GH' && !gh.region ? '—' : delivery === 0 ? 'Free' : money(delivery)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd>{money(total)}</dd></div>
          </dl>
          <p className="text-xs text-muted">Prices include VAT where applicable.</p>
          <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-medium text-white transition hover:bg-brand hover:text-ink">
            <LockIcon width={18} height={18} /> Place order · {money(total)}
          </button>
          <Link href="/cart" className="block text-center text-sm text-muted underline">Back to bag</Link>
        </aside>
      </form>
    </div>
  );
}
