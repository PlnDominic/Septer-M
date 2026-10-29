'use client';

import { useState } from 'react';
import { useShop } from './providers';

export function QuickAdd({ slug }: { slug: string }) {
  const { add } = useShop();
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        add(slug);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className="mt-1 w-fit rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-brand hover:text-ink"
    >
      {added ? 'Added ✓' : 'Quick add'}
    </button>
  );
}
