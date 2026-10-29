import Link from 'next/link';
import { CATEGORIES, PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/product-card';

export const metadata = { title: 'Shop' };

interface Params { category?: string; collection?: string; q?: string }

export default async function Shop({ searchParams }: { searchParams: Promise<Params> }) {
  const { category, collection, q } = await searchParams;
  const term = q?.trim().toLowerCase();

  const items = PRODUCTS.filter((p) => {
    if (category && p.category !== category) return false;
    if (collection === 'new' && !p.isNew) return false;
    if (collection === 'best' && !p.bestSeller) return false;
    if (term && !`${p.name} ${p.tagline} ${p.ingredients} ${p.concerns.join(' ')} ${p.skinTypes.join(' ')}`.toLowerCase().includes(term)) return false;
    return true;
  });

  const title = q ? `Results for “${q}”` : collection === 'new' ? 'New arrivals' : collection === 'best' ? 'Best sellers' : 'Shop';
  const tab = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm ${active ? 'border-sage bg-sage text-white' : 'border-line bg-card hover:border-sage'}`;

  return (
    <div className="py-12">
      <h1 className="font-serif text-4xl">{title}</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/shop" className={tab(!category && !collection && !q)}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={`/shop?category=${c.id}`} className={tab(category === c.id)}>{c.label}</Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">{items.length} {items.length === 1 ? 'product' : 'products'}</p>
      {items.length === 0 ? (
        <p className="mt-6 text-muted">Nothing matches. <Link href="/shop" className="underline">Browse everything</Link>.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      )}
    </div>
  );
}
