import Image from 'next/image';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/products';

export function Footer() {
  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5">
              <Image src="/brand/mark.png" alt="" width={462} height={534} className="h-full w-auto" />
            </span>
            <span className="font-display text-xl">
              Septer<span className="text-brand">•M</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/70">Simple, effective skincare delivered to the UK and Ghana.</p>
        </div>
        <div>
          <h3 className="text-sm">Shop</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            {CATEGORIES.map((c) => (
              <li key={c.id}><Link href={`/shop?category=${c.id}`} className="hover:text-brand">{c.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li><Link href="/about" className="hover:text-brand">About</Link></li>
            <li><Link href="/contact" className="hover:text-brand">Contact</Link></li>
            <li><Link href="/account" className="hover:text-brand">Account</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm">Payments</h3>
          <p className="mt-3 text-sm text-white/70">Cards in the UK. Cards and Mobile Money in Ghana.</p>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-white/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Septer-M. Delivering to the UK and Ghana.</p>
          <p>Patch test before first use. Discontinue if irritation occurs.</p>
        </div>
      </div>
    </footer>
  );
}
