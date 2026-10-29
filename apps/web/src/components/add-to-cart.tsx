'use client';

import { useState } from 'react';
import { useShop } from './providers';

export function AddToCart({ slug }: { slug: string }) {
  const { add } = useShop();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-full border border-line bg-card">
        <button type="button" className="h-11 w-11 text-lg" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>
          −
        </button>
        <span className="w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
        <button type="button" className="h-11 w-11 text-lg" aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}>
          +
        </button>
      </div>
      <button
        type="button"
        className="h-11 flex-1 rounded-full bg-ink px-6 font-medium text-white transition hover:bg-brand hover:text-ink"
        onClick={() => {
          add(slug, qty);
          setAdded(true);
          setTimeout(() => setAdded(false), 1800);
        }}
      >
        {added ? 'Added ✓' : 'Add to bag'}
      </button>
    </div>
  );
}
