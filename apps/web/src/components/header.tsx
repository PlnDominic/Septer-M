'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Region } from '@septer-m/shared';
import { CATEGORIES } from '@/lib/products';
import { NAV, NAV_AFTER } from '@/lib/site';
import { useShop } from './providers';
import { BagIcon, ChevronIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from './icons';

const Badge = ({ n }: { n: number }) =>
  n > 0 ? (
    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] text-white">{n}</span>
  ) : null;

export function Header() {
  const { region, setRegion, count, wishlist } = useShop();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');

  const link = (href: string) =>
    `py-1 text-sm transition hover:text-sage-dark ${href === pathname ? 'border-b-2 border-clay' : 'border-b-2 border-transparent'}`;
  const icon = 'relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
    setSearching(false);
    setMenu(false);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <button type="button" className={`${icon} md:hidden`} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            {menu ? <CloseIcon /> : <MenuIcon />}
          </button>
          <Link href="/" className="font-serif text-xl tracking-wide sm:text-2xl">Septer-M</Link>
        </div>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={link(n.href)}>{n.label}</Link>)}
          <div className="group relative">
            <button type="button" className="flex items-center gap-1 py-1 text-sm hover:text-sage-dark">
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
          <button type="button" className={icon} aria-label="Search" aria-expanded={searching} onClick={() => setSearching((s) => !s)}><SearchIcon /></button>
          <Link href="/wishlist" className={`${icon} hidden sm:flex`} aria-label={`Wishlist (${wishlist.length})`}><HeartIcon /><Badge n={wishlist.length} /></Link>
          <Link href="/account" className={`${icon} hidden sm:flex`} aria-label="Account"><UserIcon /></Link>
          <Link href="/cart" className={icon} aria-label={`Bag (${count})`}><BagIcon /><Badge n={count} /></Link>
          <label className="ml-1">
            <span className="sr-only">Region</span>
            <select value={region} onChange={(e) => setRegion(e.target.value as Region)} className="rounded-md border border-line bg-card px-1.5 py-1 text-xs sm:text-sm">
              <option value="UK">UK · £</option>
              <option value="GH">GH · GH₵</option>
            </select>
          </label>
        </div>
      </div>

      {searching && (
        <form onSubmit={submit} role="search" className="border-t border-line">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <SearchIcon />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search serums, cleansers, ingredients…" className="h-9 flex-1 bg-transparent outline-none" />
            <button className="rounded-full bg-sage px-5 py-1.5 text-sm text-white hover:bg-sage-dark">Search</button>
          </div>
        </form>
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
  );
}
