'use client';

import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { getProduct } from '@/lib/products';
import { useShop } from '@/components/providers';
import { useToast } from '@/components/toast';
import { ProductVisual } from '@/components/product-visual';
import { CartDelivery } from '@/components/cart-delivery';

export default function CartPage() {
  const { lines, currency, setQty, add } = useShop();
  const toast = useToast();

  /** Removing is easy to do by accident on a phone, so offer an Undo. */
  const remove = (slug: string, name: string, qty: number) => {
    setQty(slug, 0);
    toast.show(<><strong>{name}</strong> removed from your bag</>, { actions: [{ label: 'Undo', onClick: () => add(slug, qty, { silent: true }), primary: true }], duration: 7000 });
  };
  const rows = lines.flatMap((l) => {
    const product = getProduct(l.slug);
    return product ? [{ product, qty: l.qty }] : [];
  });
  const subtotal = rows.reduce((sum, r) => sum + r.product.price[currency] * r.qty, 0);

  if (rows.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="font-display text-3xl">Your bag is empty</h1>
        <Link href="/shop" className="mt-6 inline-block rounded-full bg-ink px-7 py-3 font-medium text-white hover:bg-brand hover:text-ink">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="py-12">
      <h1 className="font-display text-4xl">Your bag</h1>
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_320px]">
        <ul className="divide-y divide-line border-y border-line">
          {rows.map(({ product, qty }) => (
            <li key={product.slug} className="flex gap-4 py-5">
              <div className="w-20 shrink-0"><ProductVisual product={product} sizes="80px" /></div>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex justify-between gap-4">
                  <Link href={`/product/${product.slug}`} className="font-medium hover:text-brand-dark">{product.name}</Link>
                  <span>{formatMoney(product.price[currency] * qty, currency)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center rounded-full border border-line bg-card">
                    <button type="button" className="h-10 w-10" aria-label={`Decrease ${product.name}`} onClick={() => (qty <= 1 ? remove(product.slug, product.name, qty) : setQty(product.slug, qty - 1))}>−</button>
                    <span className="w-6 text-center tabular-nums">{qty}</span>
                    <button type="button" className="h-10 w-10" aria-label={`Increase ${product.name}`} onClick={() => setQty(product.slug, Math.min(20, qty + 1))}>+</button>
                  </div>
                  <button type="button" className="px-1 py-2.5 text-muted underline" onClick={() => remove(product.slug, product.name, qty)}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-line bg-card p-6">
          <h2 className="font-medium">Order summary</h2>
          <p className="mt-4 mb-4 flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></p>
          <CartDelivery subtotal={subtotal} />
          <Link
            href="/checkout"
            className="mt-6 flex h-11 w-full items-center justify-center rounded-full bg-ink font-medium text-white transition hover:bg-brand hover:text-ink"
          >
            Checkout
          </Link>
        </aside>
      </div>
    </div>
  );
}
