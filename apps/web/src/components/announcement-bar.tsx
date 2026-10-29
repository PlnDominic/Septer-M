'use client';

import { formatMoney } from '@/lib/money';
import { FREE_SHIPPING_OVER } from '@/lib/site';
import { useShop } from './providers';

export function AnnouncementBar() {
  const { currency } = useShop();
  return (
    <div className="bg-ink text-white">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-center gap-6 px-4 text-xs sm:justify-between">
        <span>Free shipping over {formatMoney(FREE_SHIPPING_OVER[currency], currency)}</span>
        <span className="hidden sm:inline">Pay by card or Mobile Money in Ghana</span>
        <span className="hidden md:inline">Delivering to the UK and Ghana</span>
      </div>
    </div>
  );
}
