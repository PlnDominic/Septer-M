'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { CATEGORIES } from '@/lib/products';
import { useAdmin } from '@/lib/admin/store';
import { LOW_STOCK } from '@/lib/admin/types';
import { Card, PageHeader, btnPrimary, inputClass, td, th } from '@/components/admin/ui';

export default function ProductsPage() {
  const { products, saveProduct } = useAdmin();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = products.filter((p) => !term || `${p.name} ${p.category}`.toLowerCase().includes(term));
  const label = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <>
      <PageHeader title="Products" subtitle={`${products.length} products`} action={<Link href="/admin/products/new" className={btnPrimary}>Add product</Link>} />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className={`${inputClass} mb-4 sm:max-w-xs`} />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className={th}>Product</th><th className={th}>Status</th><th className={th}>Stock</th><th className={`${th} text-right`}>Price</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.slug} className="border-t border-line hover:bg-mist/60">
                  <td className={td}>
                    <Link href={`/admin/products/${p.slug}`} className="flex items-center gap-3">
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-line"><Image src={p.image} alt="" fill sizes="48px" className="object-cover" /></span>
                      <span><span className="block font-medium hover:underline">{p.name}</span><span className="text-xs text-muted">{label(p.category)} · {p.sizeMl} ml</span></span>
                    </Link>
                  </td>
                  <td className={td}>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-900' : 'bg-neutral-200 text-neutral-700'}`}>{p.status === 'active' ? 'Active' : 'Draft'}</span>
                  </td>
                  <td className={td}>
                    <label className="sr-only" htmlFor={`stock-${p.slug}`}>Stock for {p.name}</label>
                    <input
                      id={`stock-${p.slug}`}
                      type="number"
                      min="0"
                      value={p.stock}
                      onChange={(e) => saveProduct({ ...p, stock: Math.max(0, parseInt(e.target.value || '0', 10)) }, p.slug)}
                      className={`h-9 w-20 rounded-lg border bg-white px-2 text-sm outline-none focus:border-ink ${p.stock <= LOW_STOCK ? 'border-amber-500' : 'border-line'}`}
                    />
                    {p.stock === 0 ? <span className="ml-2 text-xs font-medium text-red-700">Out of stock</span> : p.stock <= LOW_STOCK && <span className="ml-2 text-xs font-medium text-amber-800">Low</span>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>{formatMoney(p.price.GBP, 'GBP')}<div className="text-xs text-muted">{formatMoney(p.price.GHS, 'GHS')}</div></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted">No products match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
