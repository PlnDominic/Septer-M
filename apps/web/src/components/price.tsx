'use client';

import type { Product } from '@/lib/products';
import { formatMoney } from '@/lib/money';
import { useShop } from './providers';

export function Price({ product, className }: { product: Product; className?: string }) {
  const { currency } = useShop();
  return <span className={className}>{formatMoney(product.price[currency], currency)}</span>;
}
