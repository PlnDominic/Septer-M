'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Region } from '@septer-m/shared';
import { CATEGORIES } from '@/lib/products';
import { NAV, NAV_AFTER } from '@/lib/site';
import { useAuth } from './auth-provider';
import { useShop } from './providers';
import { SearchBox } from './search-box';
import { BagIcon, ChevronIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from './icons';

const Badge = ({ n }: { n: number }) =>
  n > 0 ? (
    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-ink">{n}</span>
  ) : null;

export function Header() {
  const { region, setRegion, count, wishlist } = useShop();
  const { user } = useAuth();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);

  const link = (href: string) =>
    `py-1 text-sm transition hover:text-brand-dark ${href === pathname ? 'border-b-2 border-brand' : 'border-b-2 border-transparent'}`;
  const icon = 'relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5';

  return (
    <>
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <button type="button" className={`${icon} md:hidden`} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            {menu ? <CloseIcon /> : <MenuIcon />}
          </button>
          <Link href="/" aria-label="Septer-M home" className="shrink-0 py-2">
            <Image src="/brand/wordmark.png" alt="Septer-M" width={1144} height={236} priority className="h-6 w-auto sm:h-7" />
          </Link>
        </div>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={link(n.href)}>{n.label}</Link>)}
          <div className="group relative">
            <button type="button" className="flex items-center gap-1 py-1 text-sm hover:text-brand-dark">
              Categories <ChevronIcon dir="down" />
            </button>
            <div className="invisible absolute top-full left-0 z-10 w-44 rounded-xl border border-line bg-card p-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {CATEGORIES.map((c) => (
                <Link key={c.id} href={`/shop?category=${c.id}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-paper">{c.label}</Link>
              ))}
            </div>
          </div>
          {NAV_AFTER.map((n) => <Link key={n.href} href={n.href} className={link(n.href)}>{n.label}</Link>)}
        </nav>

        <div className="flex items-center gap-0.5">
          <button type="button" className={`${icon} hidden md:flex`} aria-label="Search" aria-expanded={searching} onClick={() => setSearching((s) => !s)}><SearchIcon /></button>
          <Link href="/wishlist" className={`${icon} hidden sm:flex`} aria-label={`Wishlist (${wishlist.length})`}><HeartIcon /><Badge n={wishlist.length} /></Link>
          <Link href="/account" className={`${icon} hidden sm:flex`} aria-label={user ? 'Account (signed in)' : 'Account'}>
            <UserIcon />
            {user && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-brand ring-2 ring-paper" aria-hidden />}
          </Link>
          <Link href="/cart" className={icon} aria-label={`Bag (${count})`}><BagIcon /><Badge n={count} /></Link>
          <label className="ml-1">
            <span className="sr-only">Region</span>
            <select value={region} onChange={(e) => setRegion(e.target.value as Region)} className="h-10 rounded-md border border-line bg-card px-1.5 text-xs sm:text-sm">
              <option value="UK">UK · £</option>
              <option value="GH">GH · GH₵</option>
            </select>
          </label>
        </div>
      </div>

      {searching && (
        <div className="hidden border-t border-line md:block">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <SearchBox autoFocus onDone={() => setSearching(false)} className="mx-auto max-w-xl" />
          </div>
        </div>
      )}

      {menu && (
        <nav className="border-t border-line bg-paper md:hidden" aria-label="Mobile">
          <ul className="mx-auto max-w-6xl space-y-1 px-4 py-3">
            {[...NAV, ...CATEGORIES.map((c) => ({ href: `/shop?category=${c.id}`, label: c.label })), ...NAV_AFTER, { href: '/wishlist', label: `Wishlist (${wishlist.length})` }, { href: '/account', label: 'Account' }].map((n) => (
              <li key={n.href + n.label}><Link href={n.href} onClick={() => setMenu(false)} className="block rounded-lg px-2 py-2 hover:bg-black/5">{n.label}</Link></li>
            ))}
          </ul>
        </nav>
      )}
    </header>
    {/* Phones: search is always visible (not sticky, so it scrolls away and frees the screen). */}
    <div className="border-b border-line bg-paper px-4 py-2 md:hidden">
      <SearchBox />
    </div>
    </>
  );
}
