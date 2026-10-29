import Image from 'next/image';
import type { Product } from '@/lib/products';

interface Props {
  product: Product;
  className?: string;
  square?: boolean;
  /** Responsive hint for next/image; defaults suit grid cards. */
  sizes?: string;
  priority?: boolean;
}

export function ProductVisual({ product, className = '', square = false, sizes = '(min-width: 768px) 25vw, 50vw', priority }: Props) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-line ${square ? 'aspect-square' : 'aspect-[4/5]'} ${className}`}>
      <Image src={product.image} alt={product.name} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
