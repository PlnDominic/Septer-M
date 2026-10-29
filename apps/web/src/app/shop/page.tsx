import Link from 'next/link';
import { CATEGORIES, PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/product-card';

export const metadata = { title: 'Shop' };

export default async function Shop({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const items = category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;
  const tab = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm ${active ? 'border-sage bg-sage text-white' : 'border-line bg-card hover:border-sage'}`;

  return (
    <div className="py-12">
      <h1 className="font-serif text-4xl">Shop</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/shop" className={tab(!category)}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={`/shop?category=${c.id}`} className={tab(category === c.id)}>
            {c.label}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="mt-10 text-muted">Nothing here yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
