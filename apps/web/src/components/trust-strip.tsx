'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { FREE_SHIPPING_OVER, RETURN_DAYS } from '@/lib/site';
import { useShop } from './providers';
import { ChatIcon, LeafIcon, LockIcon, ReturnIcon, TruckIcon } from './icons';

function Item({ icon, title, body, href }: { icon: ReactNode; title: string; body: string; href?: string }) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    href ? <Link href={href} className="flex items-center gap-3 hover:opacity-80">{children}</Link> : <div className="flex items-center gap-3">{children}</div>;
  return (
    <Wrapper>
      <span className="text-brand">{icon}</span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{body}</p>
      </div>
    </Wrapper>
  );
}

export function TrustStrip({ variant = 'top' }: { variant?: 'top' | 'bottom' }) {
  const { currency } = useShop();
  return (
    <div className={`grid grid-cols-2 gap-5 rounded-2xl border border-line bg-card px-6 py-5 lg:grid-cols-4 ${variant === 'bottom' ? 'bg-paper' : ''}`}>
      {variant === 'top' ? (
        <>
          <Item icon={<TruckIcon />} title="Free shipping" body={`On orders over ${formatMoney(FREE_SHIPPING_OVER[currency], currency)}`} />
          <Item icon={<LockIcon />} title="Secure payments" body="Cards and Mobile Money" />
          <Item icon={<ReturnIcon />} title="Easy returns" body={`${RETURN_DAYS}-day return policy`} />
          <Item icon={<ChatIcon />} title="Skin advice" body="Ask us about your routine" />
        </>
      ) : (
        <>
          <Item icon={<LeafIcon />} title="Full ingredient lists" body="Every INCI, on every page" />
          <Item icon={<TruckIcon />} title="UK and Ghana delivery" body="Cost and arrival date shown first" href="/shipping" />
          <Item icon={<LockIcon />} title="Secure checkout" body="Cards and Mobile Money" />
          <Item icon={<ReturnIcon />} title="Easy returns" body={`${RETURN_DAYS} days for unopened items`} href="/returns" />
        </>
      )}
    </div>
  );
}
