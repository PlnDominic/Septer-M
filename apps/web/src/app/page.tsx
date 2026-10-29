import Link from 'next/link';
import { CATEGORIES, PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/product-card';

export default function Home() {
  return (
    <>
      <section className="grid items-center gap-8 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="mb-3 text-sm tracking-widest text-sage-dark uppercase">Skincare, made simple</p>
          <h1 className="font-serif text-4xl leading-tight md:text-6xl">Honest formulas for skin that feels like yours.</h1>
          <p className="mt-5 max-w-md text-muted">
            A short list of well-made essentials, designed to work together and shipped to the UK and Ghana.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/shop" className="rounded-full bg-sage px-7 py-3 font-medium text-white hover:bg-sage-dark">
              Shop all
            </Link>
            <Link href="/shop?category=serum" className="rounded-full border border-line bg-card px-7 py-3 hover:border-sage">
              Explore serums
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {PRODUCTS.slice(1, 5).map((p, i) => (
            <div key={p.slug} className={i % 2 ? 'mt-8' : ''}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </section>

      <section className="py-10">
        <h2 className="mb-6 font-serif text-2xl">Shop by category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/shop?category=${c.id}`}
              className="rounded-2xl border border-line bg-card px-4 py-6 text-center transition hover:border-sage"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="py-10">
        <h2 className="mb-6 font-serif text-2xl">Best sellers</h2>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {PRODUCTS.slice(0, 4).map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
