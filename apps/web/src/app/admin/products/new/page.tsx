'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/product-form';

export default function NewProduct() {
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-block text-sm text-muted hover:text-ink">← Products</Link>
      <PageHeader title="Add product" />
      <ProductForm />
    </>
  );
}
