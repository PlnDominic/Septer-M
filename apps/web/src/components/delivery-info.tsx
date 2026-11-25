'use client';

import Link from 'next/link';
import { allShippingOptions, estimateArrival, FREE_SHIPPING_OVER } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { formatArrival, useNow } from '@/lib/delivery-format';
import { RETURN_DAYS } from '@/lib/site';
import { useShop } from './providers';
import { LockIcon, ReturnIcon, TruckIcon } from './icons';

/** What a shopper wants to know before buying: what delivery costs, when it arrives, and how to return it. */
export function DeliveryInfo() {
  const { region, currency } = useShop();
  const now = useNow();
  const money = (n: number) => formatMoney(n, currency);

  return (
    <section aria-label="Delivery and returns" className="mt-8 space-y-4 rounded-2xl border border-line p-4 text-sm">
      <div className="flex gap-3">
        <span className="mt-0.5 text-brand"><TruckIcon width={22} height={22} /></span>
        <div className="flex-1">
          <p className="font-medium">Delivery to {region === 'UK' ? 'the UK' : 'Ghana'}</p>
          <ul className="mt-1.5 space-y-1.5">
            {allShippingOptions(region).map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {o.label}
                  <span className="block text-xs text-muted">
                    {now ? `Arrives ${formatArrival(estimateArrival(now, o.minDays, o.maxDays))}` : o.detail}
                  </span>
                </span>
                <span className="font-medium">{money(o.price)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Free {region === 'UK' ? 'standard ' : ''}delivery on orders over {money(FREE_SHIPPING_OVER[currency])}. Dates are estimates and exclude weekends and public holidays.{' '}
            <Link href="/shipping" className="underline">Delivery details</Link>
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <span className="mt-0.5 text-brand"><ReturnIcon width={22} height={22} /></span>
        <div>
          <p className="font-medium">{RETURN_DAYS}-day returns</p>
          <p className="text-xs text-muted">Unopened, unused products. <Link href="/returns" className="underline">Returns policy</Link></p>
        </div>
      </div>

      <div className="flex gap-3">
        <span className="mt-0.5 text-brand"><LockIcon width={22} height={22} /></span>
        <div>
          <p className="font-medium">Secure checkout</p>
          <p className="text-xs text-muted">{region === 'UK' ? 'Pay by card, Apple Pay or Google Pay.' : 'Pay with Mobile Money or card.'}</p>
        </div>
      </div>
    </section>
  );
}
