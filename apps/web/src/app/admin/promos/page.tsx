'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiEnabled, orderErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { useAdminApi } from '@/lib/admin/use-admin-api';
import { btnGhost, btnPrimary, Card, fmtDate, inputClass, PageHeader, td, th } from '@/components/admin/ui';

interface Promo {
  id: string; code: string; description: string; kind: 'percent' | 'fixed'; percent: number | null; amountGbp: number | null; amountGhs: number | null;
  minSubtotalGbp: number; minSubtotalGhs: number; maxUses: number | null; uses: number; firstOrderOnly: boolean; onePerEmail: boolean;
  startsAt: string | null; endsAt: string | null; active: boolean; restrictedEmail?: string | null;
}

const minor = (v: string) => Math.round(parseFloat(v) * 100);
const describe = (p: Promo) => (p.kind === 'percent' ? `${p.percent}% off` : [p.amountGbp && `${formatMoney(p.amountGbp, 'GBP')} off`, p.amountGhs && `${formatMoney(p.amountGhs, 'GHS')} off`].filter(Boolean).join(' / '));

export default function PromosPage() {
  const call = useAdminApi();
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', description: '', kind: 'percent', percent: '10', gbp: '', ghs: '', minGbp: '', minGhs: '', maxUses: '', first: false, onePerEmail: true, ends: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    call<Promo[]>('/discounts').then(setPromos).catch((e) => setError(orderErrorMessage(e)));
  }, [call]);
  useEffect(() => {
    if (apiEnabled) load();
  }, [load]);

  if (!apiEnabled) {
    return (
      <>
        <PageHeader title="Promo codes" />
        <p className="rounded-xl bg-white p-5 text-sm text-muted">Promo codes need the shop connected to its database. They aren’t available in demo mode.</p>
      </>
    );
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: Record<string, unknown> = {
      code: form.code, description: form.description, kind: form.kind, firstOrderOnly: form.first, onePerEmail: form.onePerEmail,
    };
    if (form.kind === 'percent') body.percent = parseInt(form.percent, 10);
    else {
      if (form.gbp) body.amountGbp = minor(form.gbp);
      if (form.ghs) body.amountGhs = minor(form.ghs);
    }
    if (form.minGbp) body.minSubtotalGbp = minor(form.minGbp);
    if (form.minGhs) body.minSubtotalGhs = minor(form.minGhs);
    if (form.maxUses) body.maxUses = parseInt(form.maxUses, 10);
    if (form.ends) body.endsAt = new Date(`${form.ends}T23:59:59`).toISOString();
    setBusy(true);
    try {
      await call('/discounts', body);
      setForm((f) => ({ ...f, code: '', description: '', gbp: '', ghs: '', minGbp: '', minGhs: '', maxUses: '', ends: '' }));
      load();
    } catch (err) {
      setError(orderErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: Promo) => {
    setError(null);
    try {
      await call(`/discounts/${p.id}/active`, { active: !p.active });
      load();
    } catch (err) {
      setError(orderErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Promo codes" subtitle="Customers enter these at checkout. The server works out the discount, so it can’t be edited in the browser." />
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title="Codes">
          {promos === null ? (
            <p className="p-5 text-sm text-muted">Loading…</p>
          ) : promos.length === 0 ? (
            <p className="p-5 text-sm text-muted">No promo codes yet. The welcome code for new subscribers is created automatically.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className={th}>Code</th><th className={th}>Offer</th><th className={th}>Used</th><th className={th}>Rules</th><th className={th}>Status</th></tr></thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className={`${td} font-mono font-medium`}>{p.code}</td>
                      <td className={td}>{describe(p)}{p.description && <div className="text-xs text-muted">{p.description}</div>}</td>
                      <td className={td}>{p.uses}{p.maxUses ? ` / ${p.maxUses}` : ''}</td>
                      <td className={`${td} text-xs text-muted`}>
                        {[p.firstOrderOnly && 'First order only', p.onePerEmail && 'One per email', p.restrictedEmail && 'One customer', p.minSubtotalGbp ? `Min ${formatMoney(p.minSubtotalGbp, 'GBP')}` : null, p.minSubtotalGhs ? `Min ${formatMoney(p.minSubtotalGhs, 'GHS')}` : null, p.endsAt && `Ends ${fmtDate(p.endsAt)}`].filter(Boolean).join(' · ') || 'None'}
                      </td>
                      <td className={td}>
                        <button type="button" onClick={() => void toggle(p)} aria-label={`${p.active ? 'Switch off' : 'Switch on'} ${p.code}`} className={`${btnGhost} h-8 px-3 text-xs`}>
                          {p.active ? 'Active · switch off' : 'Off · switch on'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="New code">
          <form onSubmit={create} className="space-y-3 p-5 text-sm">
            <div><label htmlFor="pc-code" className="text-xs text-muted">Code</label><input id="pc-code" className={`${inputClass} uppercase`} value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="SPRING15" required /></div>
            <div><label htmlFor="pc-desc" className="text-xs text-muted">Note (optional)</label><input id="pc-desc" className={inputClass} value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
            <div>
              <label htmlFor="pc-kind" className="text-xs text-muted">Type</label>
              <select id="pc-kind" className={inputClass} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </select>
            </div>
            {form.kind === 'percent' ? (
              <div><label htmlFor="pc-pct" className="text-xs text-muted">Percent off (1–100)</label><input id="pc-pct" type="number" min="1" max="100" className={inputClass} value={form.percent} onChange={(e) => set('percent', e.target.value)} /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="pc-gbp" className="text-xs text-muted">£ off</label><input id="pc-gbp" type="number" step="0.01" min="0" className={inputClass} value={form.gbp} onChange={(e) => set('gbp', e.target.value)} /></div>
                <div><label htmlFor="pc-ghs" className="text-xs text-muted">GH₵ off</label><input id="pc-ghs" type="number" step="0.01" min="0" className={inputClass} value={form.ghs} onChange={(e) => set('ghs', e.target.value)} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="pc-min-gbp" className="text-xs text-muted">Min spend £</label><input id="pc-min-gbp" type="number" step="0.01" min="0" className={inputClass} value={form.minGbp} onChange={(e) => set('minGbp', e.target.value)} /></div>
              <div><label htmlFor="pc-min-ghs" className="text-xs text-muted">Min spend GH₵</label><input id="pc-min-ghs" type="number" step="0.01" min="0" className={inputClass} value={form.minGhs} onChange={(e) => set('minGhs', e.target.value)} /></div>
              <div><label htmlFor="pc-max" className="text-xs text-muted">Max uses</label><input id="pc-max" type="number" min="1" className={inputClass} value={form.maxUses} onChange={(e) => set('maxUses', e.target.value)} placeholder="Unlimited" /></div>
              <div><label htmlFor="pc-ends" className="text-xs text-muted">Last day</label><input id="pc-ends" type="date" className={inputClass} value={form.ends} onChange={(e) => set('ends', e.target.value)} /></div>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.first} onChange={(e) => set('first', e.target.checked)} /> First orders only</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.onePerEmail} onChange={(e) => set('onePerEmail', e.target.checked)} /> One use per email</label>
            <button type="submit" disabled={busy || !form.code.trim()} className={`${btnPrimary} w-full`}>{busy ? 'Creating…' : 'Create code'}</button>
          </form>
        </Card>
      </div>
    </>
  );
}
