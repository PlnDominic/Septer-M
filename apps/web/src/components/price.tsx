'use client';

import type { Product } from '@/lib/products';
import { compareAtPrice } from '@/lib/products';
import { formatMoney } from '@/lib/money';
import { useShop } from './providers';

export function Price({ product, className }: { product: Product; className?: string }) {
  const { currency } = useShop();
  const was = compareAtPrice(product, currency);
  return (
    <span className={className}>
      {formatMoney(product.price[currency], currency)}
      {was !== null && <s className="ml-1.5 text-xs font-normal text-muted">{formatMoney(was, currency)}</s>}
    </span>
  );
}
