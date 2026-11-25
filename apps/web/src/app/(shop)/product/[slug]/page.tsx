import { notFound } from 'next/navigation';
import { PRODUCTS, getProduct } from '@/lib/products';
import { Price } from '@/components/price';
import { ProductVisual } from '@/components/product-visual';
import { PurchasePanel } from '@/components/purchase-panel';
import { DeliveryInfo } from '@/components/delivery-info';
import { ProductCard } from '@/components/product-card';
import { Reviews } from '@/components/reviews';
import { SITE_URL } from '@/lib/site-url';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const product = getProduct((await params).slug);
  if (!product) return {};
  const description = `${product.tagline}. ${product.sizeMl} ml. Delivered to the UK and Ghana.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { type: 'website', title: product.name, description, images: [{ url: product.image, alt: product.name }] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  const related = PRODUCTS.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 4);

  return (
    <div className="pt-6 pb-24 md:py-12">
      {/* Structured data so search engines can show price and delivery. Availability is left out until stock is live. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.tagline,
            sku: product.slug,
            category: product.category,
            image: `${SITE_URL}${product.image}`,
            brand: { '@type': 'Brand', name: 'Septer-M' },
            offers: (['GBP', 'GHS'] as const).map((c) => ({
              '@type': 'Offer',
              url: `${SITE_URL}/product/${product.slug}`,
              priceCurrency: c,
              price: (product.price[c] / 100).toFixed(2),
            })),
          }).replace(/</g, '\\u003c'),
        }}
      />
      <div className="grid gap-10 md:grid-cols-2">
        <ProductVisual product={product} sizes="(min-width: 768px) 50vw, 100vw" priority className="!aspect-square md:!aspect-[4/5]" />
        <div>
          <p className="flex items-center gap-2 text-sm tracking-widest uppercase"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden />{product.category}</p>
          <h1 className="mt-1 font-display text-4xl">{product.name}</h1>
          <p className="mt-2 text-muted">{product.tagline}</p>
          <p className="mt-5 text-2xl">
            <Price product={product} /> <span className="text-sm text-muted">· {product.sizeMl} ml</span>
          </p>
          <div className="mt-6"><PurchasePanel product={product} /></div>
          <DeliveryInfo />

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

      <Reviews slug={product.slug} productName={product.name} />

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-display text-2xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
