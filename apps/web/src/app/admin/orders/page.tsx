'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { useAdmin } from '@/lib/admin/store';
import { ORDER_STATUSES, STATUS_META, customerName, type OrderStatus } from '@/lib/admin/types';
import { Card, PageHeader, StatusBadge, fmtDate, inputClass, td, th } from '@/components/admin/ui';

export default function OrdersPage() {
  const { orders } = useAdmin();
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [region, setRegion] = useState<'all' | 'UK' | 'GH'>('all');
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const term = q.trim().toLowerCase();
  const rows = orders.filter(
    (o) =>
      (status === 'all' || o.status === status) &&
      (region === 'all' || o.region === region) &&
      (!term || `${o.number} ${customerName(o)} ${o.email}`.toLowerCase().includes(term)),
  );

  const tab = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm ${active ? 'bg-ink text-white' : 'border border-line bg-white hover:border-ink'}`;

  return (
    <>
      <PageHeader title="Orders" subtitle={`${orders.length} orders`} />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <button type="button" className={tab(status === 'all')} aria-pressed={status === 'all'} onClick={() => setStatus('all')}>All ({counts.all})</button>
        {ORDER_STATUSES.map((s) => (
          <button key={s} type="button" className={tab(status === s)} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {STATUS_META[s].label} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, name or email" aria-label="Search orders" className={`${inputClass} sm:max-w-xs`} />
        <select value={region} onChange={(e) => setRegion(e.target.value as typeof region)} aria-label="Region" className={`${inputClass} sm:w-44`}>
          <option value="all">All regions</option>
          <option value="UK">United Kingdom</option>
          <option value="GH">Ghana</option>
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className={th}>Order</th><th className={th}>Date</th><th className={th}>Customer</th><th className={th}>Payment</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.number} className="border-t border-line hover:bg-mist/60">
                  <td className={td}><Link href={`/admin/orders/${o.number}`} className="font-medium hover:underline">{o.number}</Link></td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(o.createdAt)}</td>
                  <td className={td}>{customerName(o)}<div className="text-xs text-muted">{o.email}</div></td>
                  <td className={td}>{o.payment.method === 'momo' ? 'Mobile Money' : 'Card'}<div className="text-xs text-muted">{o.region === 'UK' ? 'UK' : 'Ghana'}</div></td>
                  <td className={td}><StatusBadge status={o.status} /></td>
                  <td className={`${td} whitespace-nowrap text-right`}>{formatMoney(o.total, o.currency)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">No orders match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
