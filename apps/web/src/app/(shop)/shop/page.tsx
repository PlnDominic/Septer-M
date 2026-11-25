import { Suspense } from 'react';
import { ShopBrowser } from '@/components/shop-browser';

export const metadata = { title: 'Shop', description: 'Browse Septer-M skincare by category, skin concern and price.' };

export default function Shop() {
  return (
    <Suspense fallback={<div className="py-12 text-sm text-muted" aria-live="polite">Loading…</div>}>
      <ShopBrowser />
    </Suspense>
  );
}
