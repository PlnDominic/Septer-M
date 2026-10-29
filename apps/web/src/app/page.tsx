import Link from 'next/link';
import { CATEGORIES, PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { ProductVisual } from '@/components/product-visual';
import { Price } from '@/components/price';
import { Stars } from '@/components/stars';
import { Carousel } from '@/components/carousel';
import { TrustStrip } from '@/components/trust-strip';
import { QuickAdd } from '@/components/quick-add';
import { ArrowIcon } from '@/components/icons';

const hero = PRODUCTS.find((p) => p.slug === 'vitamin-c-brightening-serum')!;
const floating = [
  { p: PRODUCTS.find((p) => p.slug === 'gentle-gel-cleanser')!, pos: 'top-6 left-3 sm:left-0' },
  { p: PRODUCTS.find((p) => p.slug === 'daily-sunscreen-spf-50')!, pos: 'top-10 right-3 sm:right-0' },
  { p: PRODUCTS.find((p) => p.slug === 'barrier-repair-moisturiser')!, pos: 'bottom-8 left-3 hidden sm:block sm:left-4' },
];

const SectionHead = ({ title, href }: { title: string; href: string }) => (
  <div className="mb-6 flex items-end justify-between">
    <h2 className="font-serif text-2xl sm:text-3xl">{title}</h2>
    <Link href={href} className="flex items-center gap-1 text-sm text-muted hover:text-ink">View all <ArrowIcon /></Link>
  </div>
);

export default function Home() {
  const newArrivals = PRODUCTS.filter((p) => p.isNew);
  const best = PRODUCTS.filter((p) => p.bestSeller).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="mt-6 grid items-center gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#eef0e8] to-[#e4e8dc] md:grid-cols-2">
        <div className="px-6 pt-10 pb-2 sm:px-12 md:py-16">
          <p className="mb-3 text-xs font-medium tracking-widest text-clay uppercase">Skincare, made simple</p>
          <h1 className="font-serif text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">Honest formulas for skin that feels like yours.</h1>
          <p className="mt-5 max-w-sm text-muted">A short list of well-made essentials, designed to work together and delivered to the UK and Ghana.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className="inline-flex items-center gap-2 rounded-lg bg-clay px-6 py-3 font-medium text-white hover:opacity-90">Shop now <ArrowIcon /></Link>
            <Link href="/shop?collection=best" className="rounded-lg border border-line bg-card px-6 py-3 hover:border-sage">Best sellers</Link>
          </div>
        </div>
        <div className="relative mx-auto h-[360px] w-full max-w-md sm:h-[440px]">
          <div className="absolute inset-x-12 top-4 bottom-0 rounded-t-[999px] bg-gradient-to-b from-clay/80 to-clay/30" />
          <div className="absolute inset-x-1/4 top-12 bottom-6"><ProductVisual product={hero} className="h-full !aspect-auto shadow-xl" /></div>
          {floating.map(({ p, pos }) => (
            <Link key={p.slug} href={`/product/${p.slug}`} className={`absolute ${pos} w-28 rounded-xl bg-white p-2 shadow-lg transition hover:-translate-y-0.5 sm:w-36`}>
              <ProductVisual product={p} square className="mb-1.5 !rounded-lg" />
              <p className="truncate text-[11px] font-medium">{p.name}</p>
              <Price product={p} className="text-[11px] text-muted" />
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6"><TrustStrip /></div>

      {/* Categories */}
      <section className="pt-14">
        <SectionHead title="Shop by category" href="/shop" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => {
            const sample = PRODUCTS.find((p) => p.category === c.id)!;
            return (
              <Link key={c.id} href={`/shop?category=${c.id}`} className="group relative block overflow-hidden rounded-2xl">
                <ProductVisual product={sample} square className="transition duration-300 group-hover:scale-105" />
                <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-xl bg-white/95 px-3 py-2">
                  <span className="text-sm font-medium">{c.label}</span>
                  <ArrowIcon />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* New arrivals */}
      <section className="pt-14">
        <SectionHead title="New arrivals" href="/shop?collection=new" />
        <Carousel label="new arrivals">
          {newArrivals.map((p) => (
            <div key={p.slug} className="w-44 shrink-0 snap-start sm:w-56"><ProductCard product={p} /></div>
          ))}
        </Carousel>
      </section>

      {/* Best sellers */}
      <section className="pt-14">
        <SectionHead title="Best sellers" href="/shop?collection=best" />
        <div className="grid gap-4 lg:grid-cols-3">
          {best.map((p) => (
            <article key={p.slug} className="relative flex gap-4 rounded-2xl border border-line bg-card p-4">
              <span className="absolute top-3 left-3 z-[1] rounded-md bg-amber-400 px-2 py-0.5 text-[11px] font-medium">Bestseller</span>
              <Link href={`/product/${p.slug}`} className="w-32 shrink-0"><ProductVisual product={p} /></Link>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                <Link href={`/product/${p.slug}`} className="font-medium leading-snug hover:text-sage-dark">{p.name}</Link>
                <Price product={p} className="font-medium" />
                <Stars value={p.rating.value} count={p.rating.count} />
                <p className="text-xs text-muted">{p.tagline}</p>
                <QuickAdd slug={p.slug} />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Promo banners */}
      <section className="grid gap-4 pt-14 md:grid-cols-2">
        <Link href="/shop" className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-clay to-[#e08a5a] p-8 text-white sm:p-10">
          <p className="text-sm opacity-90">Build your routine</p>
          <h3 className="mt-1 max-w-xs font-serif text-3xl leading-tight">Cleanse. Treat. Protect.</h3>
          <p className="mt-3 max-w-xs text-sm opacity-90">Three simple steps, every product made to work together.</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-ink">Shop the routine <ArrowIcon /></span>
          <div className="absolute -right-6 -bottom-6 w-40 rotate-6 opacity-95 transition group-hover:rotate-3 sm:w-48"><ProductVisual product={PRODUCTS[1]} /></div>
        </Link>
        <Link href="/shop?collection=new" className="group relative overflow-hidden rounded-3xl bg-ink p-8 text-white sm:p-10">
          <p className="text-sm opacity-80">Just landed</p>
          <h3 className="mt-1 max-w-xs font-serif text-3xl leading-tight">Overnight Hydration Mask</h3>
          <p className="mt-3 max-w-xs text-sm opacity-80">Wake up to plump, rested skin.</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-ink">See new arrivals <ArrowIcon /></span>
          <div className="absolute -right-6 -bottom-6 w-40 -rotate-6 opacity-95 transition group-hover:-rotate-3 sm:w-48"><ProductVisual product={PRODUCTS[6]} /></div>
        </Link>
      </section>

      <div className="mt-14"><TrustStrip variant="bottom" /></div>
    </>
  );
}
