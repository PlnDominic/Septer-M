import type { Currency } from '@septer-m/shared';
import { REVENUE_STATUSES, type AdminOrder } from './types';

const DAY = 86_400_000;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface DayPoint {
  date: Date;
  revenue: number;
  orders: number;
}

/** Revenue and order count per calendar day for one currency (never mix currencies). */
export function revenueByDay(orders: AdminOrder[], currency: Currency, days: number, now: Date): DayPoint[] {
  const today = startOfDay(now).getTime();
  const points: DayPoint[] = Array.from({ length: days }, (_, i) => ({ date: new Date(today - (days - 1 - i) * DAY), revenue: 0, orders: 0 }));
  for (const o of orders) {
    if (o.currency !== currency || !REVENUE_STATUSES.includes(o.status)) continue;
    const idx = Math.floor((startOfDay(new Date(o.createdAt)).getTime() - points[0].date.getTime()) / DAY);
    if (idx >= 0 && idx < days) {
      points[idx].revenue += o.total;
      points[idx].orders += 1;
    }
  }
  return points;
}

export function topProducts(orders: AdminOrder[], currency: Currency, limit = 5) {
  const map = new Map<string, { name: string; units: number; revenue: number }>();
  for (const o of orders) {
    if (o.currency !== currency || !REVENUE_STATUSES.includes(o.status)) continue;
    for (const l of o.lines) {
      const row = map.get(l.slug) ?? { name: l.name, units: 0, revenue: 0 };
      row.units += l.qty;
      row.revenue += l.unitPrice * l.qty;
      map.set(l.slug, row);
    }
  }
  return [...map.entries()].map(([slug, v]) => ({ slug, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** Round a max value up to a tidy axis ceiling and return tick values. */
export function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { ceil: 1, ticks: [0, 1] };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ceil = Math.ceil(max / step) * step;
  return { ceil, ticks: Array.from({ length: Math.round(ceil / step) + 1 }, (_, i) => i * step) };
}
