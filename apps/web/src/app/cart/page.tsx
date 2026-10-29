'use client';

import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { getProduct } from '@/lib/products';
import { useShop } from '@/components/providers';
import { ProductVisual } from '@/components/product-visual';

export default function CartPage() {
  const { lines, currency, setQty } = useShop();
  const rows = lines.flatMap((l) => {
    const product = getProduct(l.slug);
    return product ? [{ product, qty: l.qty }] : [];
  });
  const subtotal = rows.reduce((sum, r) => sum + r.product.price[currency] * r.qty, 0);

  if (rows.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="font-serif text-3xl">Your bag is empty</h1>
        <Link href="/shop" className="mt-6 inline-block rounded-full bg-sage px-7 py-3 font-medium text-white hover:bg-sage-dark">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="py-12">
      <h1 className="font-serif text-4xl">Your bag</h1>
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_320px]">
        <ul className="divide-y divide-line border-y border-line">
          {rows.map(({ product, qty }) => (
            <li key={product.slug} className="flex gap-4 py-5">
              <div className="w-20 shrink-0"><ProductVisual product={product} sizes="80px" /></div>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex justify-between gap-4">
                  <Link href={`/product/${product.slug}`} className="font-medium hover:text-sage-dark">{product.name}</Link>
                  <span>{formatMoney(product.price[currency] * qty, currency)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center rounded-full border border-line bg-card">
                    <button type="button" className="h-8 w-8" aria-label={`Decrease ${product.name}`} onClick={() => setQty(product.slug, qty - 1)}>−</button>
                    <span className="w-6 text-center tabular-nums">{qty}</span>
                    <button type="button" className="h-8 w-8" aria-label={`Increase ${product.name}`} onClick={() => setQty(product.slug, qty + 1)}>+</button>
                  </div>
                  <button type="button" className="text-muted underline" onClick={() => setQty(product.slug, 0)}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-line bg-card p-6">
          <h2 className="font-medium">Order summary</h2>
          <p className="mt-4 flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></p>
          <p className="mt-1 text-sm text-muted">Shipping and tax calculated at checkout.</p>
          <button
            type="button"
            disabled
            className="mt-6 h-11 w-full cursor-not-allowed rounded-full bg-sage/50 font-medium text-white"
          >
            Checkout (coming soon)
          </button>
        </aside>
      </div>
    </div>
  );
}
