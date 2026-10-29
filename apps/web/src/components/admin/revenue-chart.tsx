'use client';

import { useId, useState } from 'react';
import type { Currency } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { niceScale, type DayPoint } from '@/lib/admin/stats';

const W = 720;
const H = 260;
const M = { top: 12, right: 8, bottom: 28, left: 56 };
const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Single-series daily revenue. Brand orange, one axis, no legend (the card title names the series). */
export function RevenueChart({ points, currency }: { points: DayPoint[]; currency: Currency }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();

  const { ceil, ticks } = niceScale(Math.max(...points.map((p) => p.revenue)));
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const slot = iw / points.length;
  const bar = Math.max(2, slot - 2); // 2px surface gap between bars
  const y = (v: number) => M.top + ih - (v / ceil) * ih;
  const money = (n: number) => formatMoney(n, currency);
  const compact = (n: number) => (n === 0 ? '0' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n / 100));
  const active = hover !== null ? points[hover] : null;
  const total = points.reduce((n, p) => n + p.revenue, 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 px-5 pt-4">
        <p className="text-sm text-muted" aria-live="polite">
          {active ? (
            <>
              <span className="font-medium text-ink">{day(active.date)}</span> · {money(active.revenue)} · {active.orders} {active.orders === 1 ? 'order' : 'orders'}
            </>
          ) : (
            <>Total <span className="font-medium text-ink">{money(total)}</span> over {points.length} days</>
          )}
        </p>
        <button type="button" onClick={() => setTable((t) => !t)} aria-pressed={table} className="text-xs underline">
          {table ? 'View chart' : 'View as table'}
        </button>
      </div>

      {table ? (
        <div className="max-h-72 overflow-auto px-5 pb-4">
          <table className="w-full text-sm">
            <caption className="sr-only">Daily revenue in {currency}</caption>
            <thead><tr><th className="py-1 text-left text-xs text-muted">Date</th><th className="py-1 text-right text-xs text-muted">Orders</th><th className="py-1 text-right text-xs text-muted">Revenue</th></tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date.toISOString()} className="border-t border-line"><td className="py-1">{day(p.date)}</td><td className="py-1 text-right">{p.orders}</td><td className="py-1 text-right">{money(p.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-labelledby={`${id}-t`} onMouseLeave={() => setHover(null)}>
          <title id={`${id}-t`}>{`Daily revenue in ${currency}, last ${points.length} days. Total ${money(total)}.`}</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#e6e6e6" strokeWidth={1} />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#555555">{compact(t)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = M.left + i * slot + (slot - bar) / 2;
            const h = Math.max(0, (p.revenue / ceil) * ih);
            const r = Math.min(4, bar / 2, h);
            return (
              <g key={p.date.toISOString()}>
                {h > 0 && (
                  <path
                    d={`M${x},${M.top + ih} V${M.top + ih - h + r} Q${x},${M.top + ih - h} ${x + r},${M.top + ih - h} H${x + bar - r} Q${x + bar},${M.top + ih - h} ${x + bar},${M.top + ih - h + r} V${M.top + ih} Z`}
                    fill="#ff5500"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                {/* full-height hit target, wider than the mark */}
                <rect x={M.left + i * slot} y={M.top} width={slot} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
                {(i % Math.ceil(points.length / 6) === 0 || i === points.length - 1) && (
                  <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#555555">{day(p.date)}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <span id={id} className="sr-only" />
    </div>
  );
}
