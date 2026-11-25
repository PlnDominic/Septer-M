'use client';

import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/products';
import { Price } from './price';
import { useShop } from './providers';

/**
 * Quantity picker + Add to bag. On phones, once the main button scrolls out of view, a bar with the
 * price and an Add to bag button stays pinned to the bottom of the screen.
 */
export function PurchasePanel({ product }: { product: Product }) {
  const { add } = useShop();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [mainVisible, setMainVisible] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setMainVisible(entry.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // While the bar is up on a phone, leave room under the page so it never hides the footer.
  useEffect(() => {
    const show = !mainVisible && window.matchMedia('(max-width: 767px)').matches;
    document.body.style.paddingBottom = show ? '5.5rem' : '';
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, [mainVisible]);

  const addToBag = () => {
    add(product.slug, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };
  const label = added ? 'Added ✓' : 'Add to bag';

  return (
    <>
      <div ref={mainRef} className="flex max-w-sm items-center gap-3">
        <div className="flex items-center rounded-full border border-line bg-card">
          <button type="button" className="h-11 w-11 text-lg" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
          <button type="button" className="h-11 w-11 text-lg" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
        </div>
        <button type="button" className="h-11 flex-1 rounded-full bg-ink px-6 font-medium text-white transition hover:bg-brand hover:text-ink" onClick={addToBag}>
          {label}
        </button>
      </div>

      {!mainVisible && (
        <div
          data-testid="sticky-buy-bar"
          className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.08)] md:hidden"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <Price product={product} className="text-sm" />
          </div>
          <button type="button" className="h-11 shrink-0 rounded-full bg-ink px-6 font-medium text-white transition active:bg-brand active:text-ink" onClick={addToBag}>
            {label}
          </button>
        </div>
      )}
    </>
  );
}
