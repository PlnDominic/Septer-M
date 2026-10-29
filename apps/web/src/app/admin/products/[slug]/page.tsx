'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAdmin } from '@/lib/admin/store';
import { PageHeader } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/product-form';

export default function EditProduct() {
  const { slug } = useParams<{ slug: string }>();
  const { products } = useAdmin();
  const product = products.find((p) => p.slug === slug);

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-block text-sm text-muted hover:text-ink">← Products</Link>
      {product ? (
        <>
          <PageHeader title={product.name} />
          <ProductForm key={product.slug} product={product} />
        </>
      ) : (
        <PageHeader title="Product not found" />
      )}
    </>
  );
}
