import { notFound } from 'next/navigation';
import { PRODUCTS, getProduct } from '@/lib/products';
import { Price } from '@/components/price';
import { ProductVisual } from '@/components/product-visual';
import { AddToCart } from '@/components/add-to-cart';
import { ProductCard } from '@/components/product-card';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const product = getProduct((await params).slug);
  return product ? { title: product.name, description: product.tagline } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  const related = PRODUCTS.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 4);

  return (
    <div className="py-12">
      <div className="grid gap-10 md:grid-cols-2">
        <ProductVisual product={product} />
        <div>
          <p className="text-sm tracking-widest text-sage-dark uppercase">{product.category}</p>
          <h1 className="mt-1 font-serif text-4xl">{product.name}</h1>
          <p className="mt-2 text-muted">{product.tagline}</p>
          <p className="mt-5 text-2xl">
            <Price product={product} /> <span className="text-sm text-muted">· {product.sizeMl} ml</span>
          </p>
          <div className="mt-6 max-w-sm"><AddToCart slug={product.slug} /></div>

          <dl className="mt-10 space-y-6 text-sm">
            <div>
              <dt className="font-medium">Best for</dt>
              <dd className="mt-1 text-muted">{product.skinTypes.join(', ')}</dd>
            </div>
            <div>
              <dt className="font-medium">Targets</dt>
              <dd className="mt-1 text-muted">{product.concerns.join(', ')}</dd>
            </div>
            <div>
              <dt className="font-medium">How to use</dt>
              <dd className="mt-1 text-muted">{product.howToUse}</dd>
            </div>
            <div>
              <dt className="font-medium">Ingredients (INCI)</dt>
              <dd className="mt-1 text-muted">{product.ingredients}</dd>
            </div>
          </dl>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-serif text-2xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
