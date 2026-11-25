import Image from 'next/image';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/products';
import { NewsletterForm } from './newsletter-form';
import { BUSINESS, registeredLine, whatsappUrl } from '@/lib/business';

const HELP = [
  { href: '/shipping', label: 'Delivery' },
  { href: '/returns', label: 'Returns & refunds' },
  { href: '/track', label: 'Track an order' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact us' },
];
const COMPANY = [
  { href: '/about', label: 'About' },
  { href: '/account', label: 'Your account' },
];
const PAYMENTS = ['Visa', 'Mastercard', 'Apple Pay', 'Google Pay', 'MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'];

const col = 'text-sm text-white/70';
const link = 'hover:text-brand';

export function Footer() {
  const registered = registeredLine();
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
          <p className={`mt-4 max-w-xs ${col}`}>Simple, effective skincare delivered to the UK and Ghana.</p>
          {(BUSINESS.supportEmail || BUSINESS.whatsapp || BUSINESS.instagram || BUSINESS.tiktok) && (
            <ul className={`mt-4 space-y-1.5 ${col}`}>
              {BUSINESS.supportEmail && <li><a href={`mailto:${BUSINESS.supportEmail}`} className={link}>{BUSINESS.supportEmail}</a></li>}
              {BUSINESS.whatsapp && <li><a href={whatsappUrl()} className={link} rel="noopener">WhatsApp us</a></li>}
              {BUSINESS.instagram && <li><a href={BUSINESS.instagram} className={link} rel="noopener noreferrer">Instagram</a></li>}
              {BUSINESS.tiktok && <li><a href={BUSINESS.tiktok} className={link} rel="noopener noreferrer">TikTok</a></li>}
            </ul>
          )}
        </div>
        <nav aria-label="Shop">
          <h3 className="text-sm">Shop</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            {CATEGORIES.map((c) => <li key={c.id}><Link href={`/shop?category=${c.id}`} className={link}>{c.label}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Help">
          <h3 className="text-sm">Help</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            {HELP.map((l) => <li key={l.href}><Link href={l.href} className={link}>{l.label}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Company">
          <h3 className="text-sm">Company</h3>
          <ul className={`mt-3 space-y-2 ${col}`}>
            {COMPANY.map((l) => <li key={l.href}><Link href={l.href} className={link}>{l.label}</Link></li>)}
          </ul>
        </nav>
      </div>

      <NewsletterForm />

      <div className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <p className="text-xs text-white/60">We accept</p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Accepted payment methods">
            {PAYMENTS.map((p) => <li key={p} className="rounded-md border border-white/25 px-2.5 py-1 text-xs text-white/80">{p}</li>)}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-white/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {BUSINESS.name}. Delivering to the UK and Ghana.</p>
            <p className="flex gap-4">
              <Link href="/privacy" className={link}>Privacy policy</Link>
              <Link href="/terms" className={link}>Terms &amp; conditions</Link>
            </p>
          </div>
          {registered && <p>{registered}</p>}
          <p>Patch test before first use. Discontinue if irritation occurs.</p>
        </div>
      </div>
    </footer>
  );
}
