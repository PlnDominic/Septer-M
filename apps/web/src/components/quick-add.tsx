'use client';

import { useState } from 'react';
import { useShop } from './providers';

export function QuickAdd({ slug }: { slug: string }) {
  const { add, stockOf } = useShop();
  const soldOut = stockOf(slug).soldOut;
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => {
        add(slug);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className="mt-1 w-fit rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-brand hover:text-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:hover:bg-line"
    >
      {soldOut ? 'Sold out' : added ? 'Added ✓' : 'Quick add'}
    </button>
  );
}
