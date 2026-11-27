'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { CATEGORIES } from '@/lib/products';
import { useAdmin } from '@/lib/admin/store';
import { LOW_STOCK } from '@/lib/admin/types';
import { Card, PageHeader, btnPrimary, inputClass, td, th } from '@/components/admin/ui';

/** Saves when you leave the box or press Enter, not on every keystroke (each save is a request to the shop). */
function StockInput({ id, value, low, onCommit }: { id: string; value: number; low: boolean; onCommit: (n: number) => Promise<string | null> }) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(String(value)), [value]);
  const commit = async () => {
    const n = Math.max(0, parseInt(text || '0', 10) || 0);
    if (n === value) return setText(String(value));
    const failed = await onCommit(n);
    setError(failed);
    if (failed) setText(String(value));
  };
  return (
    <>
      <input
        id={id}
        type="number"
        min="0"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`h-9 w-20 rounded-lg border bg-white px-2 text-sm outline-none focus:border-ink ${low ? 'border-amber-500' : 'border-line'}`}
      />
      {error && <span role="alert" className="ml-2 text-xs text-red-700">{error}</span>}
    </>
  );
}

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
                    <StockInput id={`stock-${p.slug}`} value={p.stock} low={p.stock <= LOW_STOCK} onCommit={(n) => saveProduct({ ...p, stock: n }, p.slug)} />
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
