'use client';

import { allShippingOptions, estimateArrival, FREE_SHIPPING_OVER, shippingCost } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { formatArrival, useNow } from '@/lib/delivery-format';
import { useShop } from './providers';

/** Free-delivery progress, delivery cost and arrival dates, shown in the cart before checkout. */
export function CartDelivery({ subtotal }: { subtotal: number }) {
  const { region, currency } = useShop();
  const now = useNow();
  const money = (n: number) => formatMoney(n, currency);

  const threshold = FREE_SHIPPING_OVER[currency];
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  const options = allShippingOptions(region);

  const costs = options.map((o) => shippingCost(o, subtotal));
  const lo = Math.min(...costs);
  const hi = Math.max(...costs);
  // UK shoppers see the standard rate; Ghana's rate depends on the region, so show the range.
  const delivery = region === 'UK' ? costs[0] : lo;
  const deliveryLabel = region === 'UK' ? (costs[0] === 0 ? 'Free' : money(costs[0])) : lo === hi ? (lo === 0 ? 'Free' : money(lo)) : `${money(lo)} – ${money(hi)}`;

  return (
    <div className="space-y-4">
      <div>
        {remaining === 0 ? (
          <p className="text-sm font-medium">✓ You’ve unlocked free delivery</p>
        ) : (
          <p className="text-sm">Add <strong>{money(remaining)}</strong> more for free delivery</p>
        )}
        <div
          role="progressbar"
          aria-label="Progress to free delivery"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="mt-2 h-2 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt>Delivery</dt><dd>{deliveryLabel}</dd></div>
        <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
          <dt>{region === 'UK' ? 'Estimated total' : 'Estimated total from'}</dt>
          <dd>{money(subtotal + delivery)}</dd>
        </div>
      </dl>

      <ul className="space-y-1 text-xs text-muted">
        {options.map((o) => (
          <li key={o.id}>
            {o.label}: {now ? `arrives ${formatArrival(estimateArrival(now, o.minDays, o.maxDays))}` : o.detail}
          </li>
        ))}
        <li>Your exact delivery cost is confirmed at checkout once you enter your address.</li>
      </ul>
    </div>
  );
}
