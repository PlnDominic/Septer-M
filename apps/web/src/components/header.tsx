'use client';

import Link from 'next/link';
import type { Region } from '@septer-m/shared';
import { useShop } from './providers';

export function Header() {
  const { region, setRegion, count } = useShop();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-serif text-xl tracking-wide sm:text-2xl">Septer-M</Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-5">
          <Link href="/shop" className="hover:text-sage-dark">Shop</Link>
          <label className="flex items-center gap-1 text-muted">
            <span className="sr-only">Region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as Region)}
              className="rounded-md border border-line bg-card px-2 py-1 text-ink"
            >
              <option value="UK">UK · £</option>
              <option value="GH">Ghana · GH₵</option>
            </select>
          </label>
          <Link href="/cart" className="relative rounded-full border border-line bg-card px-4 py-1.5 hover:border-sage">
            Bag
            {count > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sage px-1 text-xs text-white">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
