'use client';

import { useMemo, useState } from 'react';
import type { Currency } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { useAdmin } from '@/lib/admin/store';
import { REVENUE_STATUSES, customerName } from '@/lib/admin/types';
import { Card, PageHeader, fmtDate, inputClass, td, th } from '@/components/admin/ui';

interface Customer {
  email: string;
  name: string;
  region: 'UK' | 'GH';
  orders: number;
  spent: Partial<Record<Currency, number>>;
  last: string;
}

export default function CustomersPage() {
  const { orders } = useAdmin();
  const [q, setQ] = useState('');

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const o of orders) {
      const c = map.get(o.email) ?? { email: o.email, name: customerName(o), region: o.region, orders: 0, spent: {}, last: o.createdAt };
      c.orders += 1;
      if (REVENUE_STATUSES.includes(o.status)) c.spent[o.currency] = (c.spent[o.currency] ?? 0) + o.total;
      if (o.createdAt > c.last) c.last = o.createdAt;
      map.set(o.email, c);
    }
    return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [orders]);

  const term = q.trim().toLowerCase();
  const rows = customers.filter((c) => !term || `${c.name} ${c.email}`.toLowerCase().includes(term));

  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} customers, built from order history`} />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search customers" className={`${inputClass} mb-4 sm:max-w-xs`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className={th}>Customer</th><th className={th}>Region</th><th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Spent</th><th className={th}>Last order</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.email} className="border-t border-line">
                  <td className={td}>{c.name}<div className="text-xs text-muted">{c.email}</div></td>
                  <td className={td}>{c.region === 'UK' ? 'UK' : 'Ghana'}</td>
                  <td className={`${td} text-right`}>{c.orders}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>{(Object.entries(c.spent) as [Currency, number][]).map(([cur, n]) => formatMoney(n, cur)).join(' · ') || '—'}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(c.last)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">No customers match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
