import Image from 'next/image';
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

const floating = [
  { p: PRODUCTS.find((p) => p.slug === 'gentle-gel-cleanser')!, pos: 'top-6 left-4' },
  { p: PRODUCTS.find((p) => p.slug === 'daily-sunscreen-spf-50')!, pos: 'bottom-6 right-4' },
  { p: PRODUCTS.find((p) => p.slug === 'barrier-repair-moisturiser')!, pos: 'bottom-6 left-4 hidden lg:block' },
];

const SectionHead = ({ title, href }: { title: string; href: string }) => (
  <div className="mb-6 flex items-end justify-between">
    <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
    <Link href={href} className="flex items-center gap-1 text-sm text-muted hover:text-ink">View all <ArrowIcon /></Link>
  </div>
);

export default function Home() {
  const newArrivals = PRODUCTS.filter((p) => p.isNew);
  const best = PRODUCTS.filter((p) => p.bestSeller).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="mt-6 grid items-stretch overflow-hidden rounded-3xl bg-mist md:grid-cols-2">
        <div className="self-center px-6 py-10 sm:px-12 md:py-16">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden />Skincare, made simple</p>
          <h1 className="font-display text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">Honest formulas for skin that feels like yours.</h1>
          <p className="mt-5 max-w-sm text-muted">A short list of well-made essentials, designed to work together and delivered to the UK and Ghana.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className="inline-flex items-center gap-2 rounded-lg bg-ink px-6 py-3 font-medium text-white transition hover:bg-brand hover:text-ink">Shop now <ArrowIcon /></Link>
            <Link href="/shop?collection=best" className="rounded-lg border border-line bg-card px-6 py-3 hover:border-brand">Best sellers</Link>
          </div>
        </div>
        <div className="relative h-[380px] w-full sm:h-[460px] md:h-full md:min-h-[480px]">
          <Image src="/images/lifestyle/hero.jpg" alt="Woman applying moisturiser to her cheek" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          {floating.map(({ p, pos }) => (
            <Link key={p.slug} href={`/product/${p.slug}`} className={`absolute ${pos} w-28 rounded-xl bg-white p-2 shadow-lg transition hover:-translate-y-0.5 sm:w-36`}>
              <ProductVisual product={p} square sizes="144px" className="mb-1.5 !rounded-lg" />
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
            return (
              <Link key={c.id} href={`/shop?category=${c.id}`} className="group relative block aspect-square overflow-hidden rounded-2xl bg-line">
                <Image src={c.image} alt="" fill sizes="(min-width: 1024px) 20vw, 50vw" className="object-cover transition duration-300 group-hover:scale-105" />
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
              <span className="absolute top-3 left-3 z-[1] rounded-md bg-brand px-2 py-0.5 text-[11px] font-medium">Bestseller</span>
              <Link href={`/product/${p.slug}`} className="w-32 shrink-0"><ProductVisual product={p} sizes="128px" /></Link>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                <Link href={`/product/${p.slug}`} className="font-medium leading-snug hover:text-brand-dark">{p.name}</Link>
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
        <Link href="/shop" className="group relative overflow-hidden rounded-3xl bg-brand p-8 pr-[44%] text-ink sm:p-10 sm:pr-[44%]">
          <p className="text-sm font-medium">Build your routine</p>
          <h3 className="mt-1 max-w-xs font-display text-3xl leading-tight">Cleanse. Treat. Protect.</h3>
          <p className="mt-3 max-w-xs text-sm">Three simple steps, every product made to work together.</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white">Shop the routine <ArrowIcon /></span>
          <div className="absolute inset-y-0 right-0 w-2/5"><Image src="/images/lifestyle/routine.jpg" alt="" fill sizes="20vw" className="object-cover transition duration-500 group-hover:scale-105" /></div>
        </Link>
        <Link href="/shop?collection=new" className="group relative overflow-hidden rounded-3xl bg-ink p-8 pr-[44%] text-white sm:p-10 sm:pr-[44%]">
          <p className="flex items-center gap-2 text-sm opacity-80"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden />Just landed</p>
          <h3 className="mt-1 max-w-xs font-display text-3xl leading-tight">Overnight Hydration Mask</h3>
          <p className="mt-3 max-w-xs text-sm opacity-80">Wake up to plump, rested skin.</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-ink">See new arrivals <ArrowIcon /></span>
          <div className="absolute inset-y-0 right-0 w-2/5"><Image src="/images/lifestyle/night.jpg" alt="" fill sizes="20vw" className="object-cover transition duration-500 group-hover:scale-105" /></div>
        </Link>
      </section>

      <div className="mt-14"><TrustStrip variant="bottom" /></div>
    </>
  );
}
