import type { ReactNode } from 'react';
import { STATUS_META, type OrderStatus } from '@/lib/admin/types';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-white ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          {title && <h2 className="text-base">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${m.tone}`}>{m.label}</span>;
}

export const inputClass = 'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ink';
export const btnPrimary = 'inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-white transition hover:bg-brand hover:text-ink disabled:opacity-40';
export const btnGhost = 'inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-medium transition hover:border-ink';

export const th = 'px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted';
export const td = 'px-5 py-3 text-sm';

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
