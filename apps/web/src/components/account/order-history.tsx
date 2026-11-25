'use client';

import { useEffect, useState } from 'react';
import type { Currency, OrderStatus } from '@septer-m/shared';
import { useAuth } from '@/components/auth-provider';
import { fmtDate } from '@/components/admin/ui';
import { StatusBadge } from '@/components/admin/ui';
import { formatMoney } from '@/lib/money';
import { getSupabase } from '@/lib/supabase/client';

interface Row {
  number: string;
  status: OrderStatus;
  currency: Currency;
  total: number;
  created_at: string;
  items: { name: string; qty: number }[];
}

/** Reads the signed-in customer's own orders; Row Level Security hides everyone else's. */
export function OrderHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    let cancelled = false;
    void supabase
      .from('orders')
      .select('number, status, currency, total, created_at, items:order_items(name, qty)')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setRows((data ?? []) as unknown as Row[]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (failed) return <p className="text-sm text-muted">We couldn’t load your orders right now. Please try again later.</p>;
  if (!rows) return <p className="text-sm text-muted">Loading your orders…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted">You haven’t placed any orders yet.</p>;

  return (
    <ul className="divide-y divide-line rounded-2xl border border-line">
      {rows.map((o) => (
        <li key={o.number} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
          <div>
            <p className="font-medium">{o.number}</p>
            <p className="text-xs text-muted">{fmtDate(o.created_at)} · {o.items.reduce((n, i) => n + i.qty, 0)} {o.items.reduce((n, i) => n + i.qty, 0) === 1 ? 'item' : 'items'}</p>
          </div>
          <StatusBadge status={o.status} />
          <p className="font-medium">{formatMoney(o.total, o.currency)}</p>
        </li>
      ))}
    </ul>
  );
}
