'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/products';
import { Price } from './price';
import { ProductVisual } from './product-visual';
import { Stars } from './stars';
import { HeartIcon, BagIcon } from './icons';
import { useShop } from './providers';

export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWish, add } = useShop();
  const [added, setAdded] = useState(false);
  const wished = wishlist.includes(product.slug);

  return (
    <div className="group relative">
      <Link href={`/product/${product.slug}`} className="block">
        <ProductVisual product={product} className="transition group-hover:shadow-lg" />
      </Link>
      <div className="absolute top-3 left-3 flex flex-col gap-1">
        {product.isNew && <span className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-medium text-white">New</span>}
        {product.salePercent && <span className="rounded-md bg-clay px-2 py-0.5 text-[11px] font-medium text-white">−{product.salePercent}%</span>}
      </div>
      <button
        type="button"
        onClick={() => toggleWish(product.slug)}
        aria-pressed={wished}
        aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        className={`absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:scale-105 ${wished ? 'text-clay' : 'text-ink'}`}
      >
        <HeartIcon filled={wished} width={16} height={16} />
      </button>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/product/${product.slug}`} className="block font-medium leading-snug hover:text-sage-dark">{product.name}</Link>
          <p className="mt-0.5 text-sm font-medium"><Price product={product} /></p>
          <div className="mt-1"><Stars value={product.rating.value} count={product.rating.count} /></div>
        </div>
        <button
          type="button"
          aria-label={`Add ${product.name} to bag`}
          onClick={() => {
            add(product.slug);
            setAdded(true);
            setTimeout(() => setAdded(false), 1500);
          }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition ${added ? 'bg-sage' : 'bg-ink hover:bg-sage-dark'}`}
        >
          {added ? '✓' : <BagIcon width={16} height={16} />}
        </button>
      </div>
    </div>
  );
}
