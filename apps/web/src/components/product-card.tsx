import Link from 'next/link';
import type { Product } from '@/lib/products';
import { Price } from './price';
import { ProductVisual } from './product-visual';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <ProductVisual product={product} className="transition group-hover:shadow-lg" />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{product.name}</h3>
          <p className="text-sm text-muted">{product.tagline}</p>
        </div>
        <Price product={product} className="whitespace-nowrap font-medium" />
      </div>
    </Link>
  );
}
