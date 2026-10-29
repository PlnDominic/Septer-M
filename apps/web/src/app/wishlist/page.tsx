'use client';

import Link from 'next/link';
import { PRODUCTS } from '@/lib/products';
import { useShop } from '@/components/providers';
import { ProductCard } from '@/components/product-card';

export default function Wishlist() {
  const { wishlist } = useShop();
  const items = PRODUCTS.filter((p) => wishlist.includes(p.slug));
  return (
    <div className="py-12">
      <h1 className="font-serif text-4xl">Wishlist</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-muted">Tap the heart on any product to save it here. <Link href="/shop" className="underline">Browse the shop</Link>.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">{items.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
      )}
    </div>
  );
}
