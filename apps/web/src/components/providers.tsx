'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { REGION_CURRENCY, type Currency, type Region } from '@septer-m/shared';
import { AuthProvider } from './auth-provider';
import { ToastProvider, useToast } from './toast';
import { getProduct } from '@/lib/products';

interface CartLine {
  slug: string;
  qty: number;
}

interface ShopState {
  /** False until cart/region have been restored from storage. */
  ready: boolean;
  region: Region;
  currency: Currency;
  setRegion: (r: Region) => void;
  lines: CartLine[];
  count: number;
  /** Adds to the bag and shows a toast with shortcuts, unless `silent`. */
  add: (slug: string, qty?: number, options?: { silent?: boolean }) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  wishlist: string[];
  toggleWish: (slug: string) => void;
}

const ShopContext = createContext<ShopState | null>(null);

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable - state just won't persist */
  }
};

function ShopProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [region, setRegionState] = useState<Region>('UK');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRegionState(read<Region>('sm.region', 'UK'));
    setLines(read<CartLine[]>('sm.cart', []));
    setWishlist(read<string[]>('sm.wishlist', []));
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) write('sm.cart', lines);
  }, [lines, ready]);

  useEffect(() => {
    if (ready) write('sm.wishlist', wishlist);
  }, [wishlist, ready]);

  const toggleWish = useCallback((slug: string) => {
    setWishlist((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));
  }, []);

  const setRegion = useCallback((r: Region) => {
    setRegionState(r);
    write('sm.region', r);
  }, []);

  const add = useCallback<ShopState['add']>(
    (slug, qty = 1, options) => {
      setLines((cur) =>
        cur.some((l) => l.slug === slug)
          ? cur.map((l) => (l.slug === slug ? { ...l, qty: l.qty + qty } : l))
          : [...cur, { slug, qty }],
      );
      if (options?.silent) return;
      const name = getProduct(slug)?.name ?? 'Item';
      toast.show(
        <>
          <strong>{qty > 1 ? `${qty} × ${name}` : name}</strong> added to your bag
        </>,
        { actions: [{ label: 'Checkout', href: '/checkout', primary: true }, { label: 'View bag', href: '/cart' }] },
      );
    },
    [toast],
  );

  const setQty = useCallback((slug: string, qty: number) => {
    setLines((cur) => (qty <= 0 ? cur.filter((l) => l.slug !== slug) : cur.map((l) => (l.slug === slug ? { ...l, qty } : l))));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<ShopState>(
    () => ({
      ready,
      region,
      currency: REGION_CURRENCY[region],
      setRegion,
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      add,
      setQty,
      clear,
      wishlist,
      toggleWish,
    }),
    [ready, region, setRegion, lines, add, setQty, clear, wishlist, toggleWish],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ShopProvider>{children}</ShopProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export function useShop(): ShopState {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside <Providers>');
  return ctx;
}
