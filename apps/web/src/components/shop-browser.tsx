'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { concernCounts, searchProducts } from '@septer-m/shared';
import { CATEGORIES, PRODUCTS } from '@/lib/products';
import { formatMoney } from '@/lib/money';
import { PRICE_BANDS } from '@/lib/site';
import { ProductCard } from './product-card';
import { useShop } from './providers';
import { CloseIcon } from './icons';

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'newest', label: 'Newest first' },
  { id: 'name', label: 'Name A–Z' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

const CONCERNS = concernCounts(PRODUCTS);
const SKIN_TYPES = [...new Set(PRODUCTS.flatMap((p) => p.skinTypes))].filter((s) => s !== 'All').sort();

const field = 'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink';
const pill = (active: boolean) =>
  `inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm ${active ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink'}`;

export function ShopBrowser() {
  const params = useSearchParams();
  const router = useRouter();
  const { currency } = useShop();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q')?.trim() ?? '';
  const category = params.get('category') ?? '';
  const collection = params.get('collection') ?? '';
  const concern = params.get('concern') ?? '';
  const skin = params.get('skin') ?? '';
  const band = params.get('price') ?? '';
  const sort = (SORTS.find((s) => s.id === params.get('sort'))?.id ?? 'featured') as SortId;

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    const qs = next.toString();
    router.replace(qs ? `/shop?${qs}` : '/shop', { scroll: false });
  };

  const [lo, hi] = PRICE_BANDS[currency];
  const money = (n: number) => formatMoney(n, currency);
  const bands = [
    { id: 'low', label: `Under ${money(lo)}` },
    { id: 'mid', label: `${money(lo)} – ${money(hi)}` },
    { id: 'high', label: `Over ${money(hi)}` },
  ];

  const { items, corrected } = useMemo(() => {
    const searched = q ? searchProducts(PRODUCTS, q) : { results: PRODUCTS, correctedQuery: undefined };
    let list = searched.results.filter((p) => {
      if (category && p.category !== category) return false;
      if (collection === 'new' && !p.isNew) return false;
      if (collection === 'best' && !p.bestSeller) return false;
      if (concern && !p.concerns.includes(concern)) return false;
      if (skin && !p.skinTypes.includes(skin) && !p.skinTypes.includes('All')) return false;
      const price = p.price[currency];
      if (band === 'low' && price >= lo) return false;
      if (band === 'mid' && (price < lo || price > hi)) return false;
      if (band === 'high' && price <= hi) return false;
      return true;
    });
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price[currency] - b.price[currency]);
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price[currency] - a.price[currency]);
    else if (sort === 'newest') list = [...list].sort((a, b) => Number(b.isNew) - Number(a.isNew));
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return { items: list, corrected: searched.correctedQuery };
  }, [q, category, collection, concern, skin, band, sort, currency, lo, hi]);

  const title = q ? `Results for “${q}”` : concern ? concern : collection === 'new' ? 'New arrivals' : collection === 'best' ? 'Best sellers' : category ? CATEGORIES.find((c) => c.id === category)?.label ?? 'Shop' : 'Shop';

  const chips: { label: string; clear: Record<string, null> }[] = [];
  if (q) chips.push({ label: `Search: ${q}`, clear: { q: null } });
  if (collection) chips.push({ label: collection === 'new' ? 'New arrivals' : 'Best sellers', clear: { collection: null } });
  if (concern) chips.push({ label: `Concern: ${concern}`, clear: { concern: null } });
  if (skin) chips.push({ label: `Skin: ${skin}`, clear: { skin: null } });
  if (band) chips.push({ label: bands.find((b) => b.id === band)?.label ?? band, clear: { price: null } });
  const anyFilter = chips.length > 0 || Boolean(category);
  const activeFilterCount = [concern, skin, band].filter(Boolean).length;

  return (
    <div className="py-8 sm:py-12">
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      {corrected && (
        <p className="mt-2 text-sm text-muted" role="status">
          Showing results for “<strong className="text-ink">{corrected}</strong>”.
        </p>
      )}

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" className={pill(!category)} onClick={() => set({ category: null })}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className={pill(category === c.id)} aria-pressed={category === c.id} onClick={() => set({ category: category === c.id ? null : c.id })}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* Phones keep the product grid near the top: filters hide behind a button, Sort stays visible. */}
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="shop-filters"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex h-11 items-center justify-between rounded-lg border border-line bg-white px-3 text-sm font-medium md:hidden"
          style={{ alignSelf: 'end' }}
        >
          <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          <span aria-hidden className={`transition ${filtersOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <div className="text-xs md:order-last">
          <label htmlFor="shop-sort" className="text-xs text-muted">Sort by</label>
          <select id="shop-sort" className={`${field} mt-1 text-ink`} value={sort} onChange={(e) => set({ sort: e.target.value === 'featured' ? null : e.target.value })}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div id="shop-filters" className={`text-xs text-muted ${filtersOpen ? '' : 'hidden md:block'}`}>
          <label htmlFor="shop-concern" className="text-xs text-muted">Skin concern</label>
          <select id="shop-concern" className={`${field} mt-1 text-ink`} value={concern} onChange={(e) => set({ concern: e.target.value || null })}>
            <option value="">All concerns</option>
            {CONCERNS.map((c) => <option key={c.concern} value={c.concern}>{c.concern} ({c.count})</option>)}
          </select>
        </div>
        <div className={`text-xs text-muted ${filtersOpen ? '' : 'hidden md:block'}`}>
          <label htmlFor="shop-skin" className="text-xs text-muted">Skin type</label>
          <select id="shop-skin" className={`${field} mt-1 text-ink`} value={skin} onChange={(e) => set({ skin: e.target.value || null })}>
            <option value="">All skin types</option>
            {SKIN_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className={`text-xs text-muted ${filtersOpen ? '' : 'hidden md:block'}`}>
          <label htmlFor="shop-price" className="text-xs text-muted">Price</label>
          <select id="shop-price" className={`${field} mt-1 text-ink`} value={band} onChange={(e) => set({ price: e.target.value || null })}>
            <option value="">Any price</option>
            {bands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm text-muted" aria-live="polite">{items.length} {items.length === 1 ? 'product' : 'products'}</p>
        {chips.map((c) => (
          <button key={c.label} type="button" onClick={() => set(c.clear)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-mist pr-2 pl-3 text-sm hover:bg-line">
            {c.label}
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white" aria-hidden><CloseIcon width={12} height={12} /></span>
            <span className="sr-only">Remove filter</span>
          </button>
        ))}
        {anyFilter && (
          <button type="button" className="text-sm underline" onClick={() => router.replace('/shop', { scroll: false })}>Clear all</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line p-6 text-center">
          <h2 className="text-lg">Nothing matches{q ? ` “${q}”` : ' those filters'}</h2>
          <p className="mt-2 text-sm text-muted">Try fewer filters, a different word, or start from a skin concern.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {CONCERNS.slice(0, 6).map((c) => (
              <Link key={c.concern} href={`/shop?concern=${encodeURIComponent(c.concern)}`} className={pill(false)}>{c.concern}</Link>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm underline">
            <Link href="/shop">Browse everything</Link>
            <Link href="/shop?collection=best">Best sellers</Link>
            <Link href="/shop?collection=new">New arrivals</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
          {items.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      )}
    </div>
  );
}
