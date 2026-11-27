'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiEnabled, orderErrorMessage } from '@/lib/api';
import { useAdminApi } from '@/lib/admin/use-admin-api';
import { btnGhost, btnPrimary, Card, fmtDate, PageHeader } from '@/components/admin/ui';

type Status = 'pending' | 'approved' | 'rejected';
interface Review { id: string; rating: number; title: string; body: string; name: string; status: Status; createdAt: string; productSlug?: string; productName?: string }

const TABS: { id: Status; label: string }[] = [
  { id: 'pending', label: 'To review' },
  { id: 'approved', label: 'Published' },
  { id: 'rejected', label: 'Rejected' },
];

export default function ReviewsPage() {
  const call = useAdminApi();
  const [tab, setTab] = useState<Status>('pending');
  const [rows, setRows] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    call<Review[]>(`/reviews?status=${tab}`).then(setRows).catch((e) => setError(orderErrorMessage(e)));
  }, [call, tab]);
  useEffect(() => {
    if (apiEnabled) load();
  }, [load]);

  if (!apiEnabled) {
    return (
      <>
        <PageHeader title="Reviews" />
        <p className="rounded-xl bg-white p-5 text-sm text-muted">Reviews need the shop connected to its database. They aren’t available in demo mode.</p>
      </>
    );
  }

  const moderate = async (id: string, status: Status) => {
    setError(null);
    try {
      await call(`/reviews/${id}/status`, { status });
      setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError(orderErrorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Reviews" subtitle="Only customers whose order shipped can write one. Approved reviews appear on the product page." />
      <div role="tablist" aria-label="Review status" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-full px-4 py-1.5 text-sm ${tab === t.id ? 'bg-ink text-white' : 'border border-line bg-white'}`}>{t.label}</button>
        ))}
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <Card>
        {rows === null ? (
          <p className="p-5 text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nothing here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="space-y-2 p-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-brand" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></span>
                  <strong>{r.title}</strong>
                  <span className="text-muted">on {r.productName} · {r.name} · {fmtDate(r.createdAt)}</span>
                </div>
                <p>{r.body}</p>
                <div className="flex gap-2">
                  {r.status !== 'approved' && <button type="button" className={`${btnPrimary} h-9`} onClick={() => void moderate(r.id, 'approved')}>Approve</button>}
                  {r.status !== 'rejected' && <button type="button" className={`${btnGhost} h-9`} onClick={() => void moderate(r.id, 'rejected')}>Reject</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
