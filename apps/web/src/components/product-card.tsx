'use client';

import { useState } from 'react';
import Link from 'next/link';
import { salePercent, type Product } from '@/lib/products';
import { Price } from './price';
import { ProductVisual } from './product-visual';
import { Stars } from './stars';
import { HeartIcon, BagIcon } from './icons';
import { useShop } from './providers';

export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWish, add, currency, stockOf } = useShop();
  const { soldOut, low } = stockOf(product.slug);
  const off = salePercent(product, currency);
  const [added, setAdded] = useState(false);
  const wished = wishlist.includes(product.slug);

  return (
    <div className="group relative">
      <Link href={`/product/${product.slug}`} className="block">
        <ProductVisual product={product} className="transition group-hover:shadow-lg" />
      </Link>
      <div className="absolute top-3 left-3 flex flex-col gap-1">
        {soldOut && <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm">Sold out</span>}
        {product.isNew && !soldOut && <span className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-medium text-white">New</span>}
        {off !== null && <span className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-semibold text-ink">−{off}%</span>}
      </div>
      <button
        type="button"
        onClick={() => toggleWish(product.slug)}
        aria-pressed={wished}
        aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        className={`absolute top-1.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-full transition hover:scale-105 ${wished ? 'text-brand-dark' : 'text-ink'}`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm"><HeartIcon filled={wished} width={16} height={16} /></span>
      </button>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/product/${product.slug}`} className="block font-medium leading-snug hover:text-brand-dark">{product.name}</Link>
          <p className="mt-0.5 text-sm font-medium"><Price product={product} /></p>
          {low !== null && !soldOut && <p className="mt-0.5 text-xs font-medium text-brand-dark">Only {low} left</p>}
          {product.rating.count > 0 && <div className="mt-1"><Stars value={product.rating.value} count={product.rating.count} /></div>}
        </div>
        <button
          type="button"
          aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to bag`}
          disabled={soldOut}
          onClick={() => {
            add(product.slug);
            setAdded(true);
            setTimeout(() => setAdded(false), 1500);
          }}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${added ? 'bg-brand !text-ink' : 'bg-ink hover:bg-brand hover:text-ink'}`}
        >
          {added ? '✓' : <BagIcon width={16} height={16} />}
        </button>
      </div>
    </div>
  );
}
