'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Currency } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { useAdmin } from '@/lib/admin/store';
import { LOW_STOCK, TO_FULFIL, customerName } from '@/lib/admin/types';
import { revenueByDay, topProducts } from '@/lib/admin/stats';
import { Card, PageHeader, StatTile, StatusBadge, fmtDate, td, th } from '@/components/admin/ui';
import { RevenueChart } from '@/components/admin/revenue-chart';

const DAYS = 30;

export default function Dashboard() {
  const { orders, products } = useAdmin();
  const [currency, setCurrency] = useState<Currency>('GBP');
  const now = useMemo(() => new Date(), []);

  const points = useMemo(() => revenueByDay(orders, currency, DAYS, now), [orders, currency, now]);
  const mine = orders.filter((o) => o.currency === currency);
  const revenue = points.reduce((n, p) => n + p.revenue, 0);
  const count = points.reduce((n, p) => n + p.orders, 0);
  const aov = count ? Math.round(revenue / count) : 0;
  const toFulfil = orders.filter((o) => TO_FULFIL.includes(o.status));
  const awaiting = orders.filter((o) => o.status === 'pending_payment').length;
  const lowStock = products.filter((p) => p.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock);
  const best = topProducts(orders, currency);
  const money = (n: number) => formatMoney(n, currency);

  const tab = (c: Currency) =>
    `rounded-full px-4 py-1.5 text-sm ${currency === c ? 'bg-ink text-white' : 'border border-line bg-white hover:border-ink'}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Last ${DAYS} days. Figures are shown per currency and never added together.`}
        action={
          <div role="group" aria-label="Currency" className="flex gap-2">
            <button type="button" aria-pressed={currency === 'GBP'} onClick={() => setCurrency('GBP')} className={tab('GBP')}>UK · £</button>
            <button type="button" aria-pressed={currency === 'GHS'} onClick={() => setCurrency('GHS')} className={tab('GHS')}>Ghana · GH₵</button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Revenue" value={money(revenue)} hint="Paid, processing, shipped and delivered" />
        <StatTile label="Orders" value={String(count)} hint={`${mine.length} placed in total`} />
        <StatTile label="Average order" value={money(aov)} />
        <StatTile label="To fulfil" value={String(toFulfil.length)} hint={`${awaiting} awaiting payment`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card title={`Daily revenue (${currency})`}>
          <RevenueChart points={points} currency={currency} />
        </Card>

        <Card title="Low stock" action={<Link href="/admin/products" className="text-xs underline">All products</Link>}>
          {lowStock.length === 0 ? (
            <p className="p-5 text-sm text-muted">Everything is well stocked.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((p) => (
                <li key={p.slug} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/admin/products/${p.slug}`} className="hover:underline">{p.name}</Link>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${p.stock === 0 ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}>
                    {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card title="Recent orders" action={<Link href="/admin/orders" className="text-xs underline">View all</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th></tr></thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.number} className="border-t border-line">
                    <td className={td}><Link href={`/admin/orders/${o.number}`} className="font-medium hover:underline">{o.number}</Link><div className="text-xs text-muted">{fmtDate(o.createdAt)}</div></td>
                    <td className={td}>{customerName(o)}<div className="text-xs text-muted">{o.region === 'UK' ? 'UK' : 'Ghana'}</div></td>
                    <td className={td}><StatusBadge status={o.status} /></td>
                    <td className={`${td} text-right`}>{formatMoney(o.total, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Top products (${currency})`}>
          {best.length === 0 ? (
            <p className="p-5 text-sm text-muted">No sales yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {best.map((p, i) => (
                <li key={p.slug} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-4 text-muted">{i + 1}</span>
                  <span className="flex-1">{p.name}<span className="block text-xs text-muted">{p.units} sold</span></span>
                  <span>{money(p.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
