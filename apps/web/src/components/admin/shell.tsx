'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/lib/admin/store';
import { TO_FULFIL } from '@/lib/admin/types';
import { CloseIcon, MenuIcon } from '@/components/icons';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { orders, ready, reset } = useAdmin();
  const [open, setOpen] = useState(false);
  const toFulfil = orders.filter((o) => TO_FULFIL.includes(o.status)).length;

  const active = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setOpen(false)}
          aria-current={active(n.href) ? 'page' : undefined}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
            active(n.href) ? 'bg-white/10 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            {active(n.href) && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />}
            {n.label}
          </span>
          {n.href === '/admin/orders' && ready && toFulfil > 0 && (
            <span className="rounded-full bg-brand px-2 text-xs font-semibold text-ink" aria-label={`${toFulfil} to fulfil`}>{toFulfil}</span>
          )}
        </Link>
      ))}
    </nav>
  );

  const brand = (
    <Link href="/admin" className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1">
        <Image src="/brand/mark.png" alt="" width={462} height={534} className="h-full w-auto" />
      </span>
      <span className="font-display text-white">Septer<span className="text-brand">•M</span> <span className="font-sans text-xs font-normal text-white/60">Admin</span></span>
    </Link>
  );

  const footer = (
    <div className="mt-auto space-y-3 border-t border-white/10 pt-4 text-xs text-white/60">
      <Link href="/" className="block hover:text-white">← View store</Link>
      <button
        type="button"
        onClick={() => {
          if (confirm('Reset all demo orders and products? Your changes in the admin will be lost.')) reset();
        }}
        className="hover:text-white"
      >
        Reset demo data
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1 bg-mist">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 bg-ink p-5 lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
          {brand}
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'} className="text-white">
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
        {open && <div className="flex flex-col gap-4 bg-ink px-4 pb-4 lg:hidden">{nav}{footer}</div>}

        <div role="note" className="border-b border-brand/40 bg-brand/10 px-4 py-2 text-xs sm:px-8">
          <strong>Demo data.</strong> The admin isn&apos;t connected to a database or sign-in yet. Changes are saved in this browser only.
        </div>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{ready ? children : <p className="text-sm text-muted">Loading…</p>}</main>
      </div>
    </div>
  );
}
