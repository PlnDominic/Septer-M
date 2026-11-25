import Image from 'next/image';
import Link from 'next/link';
import { concernCounts } from '@septer-m/shared';
import { CATEGORIES, PRODUCTS } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { ProductVisual } from '@/components/product-visual';
import { Price } from '@/components/price';
import { Stars } from '@/components/stars';
import { Carousel } from '@/components/carousel';
import { TrustStrip } from '@/components/trust-strip';
import { QuickAdd } from '@/components/quick-add';
import { ArrowIcon } from '@/components/icons';

const SectionHead = ({ title, href }: { title: string; href: string }) => (
  <div className="mb-6 flex items-end justify-between">
    <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
    <Link href={href} className="flex items-center gap-1 py-2.5 text-sm text-muted hover:text-ink">View all <ArrowIcon /></Link>
  </div>
);

export default function Home() {
  const newArrivals = PRODUCTS.filter((p) => p.isNew);
  const best = PRODUCTS.filter((p) => p.bestSeller).slice(0, 3);

  return (
    <>
      {/* Hero: full-bleed photo (breaks out of the page container to the window edges);
          the text stays aligned with the rest of the page. */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-ink">
        <Image
          src="/images/lifestyle/hero-wide.jpg"
          alt="Close-up of a woman applying moisturiser to her cheek"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_60%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-9 md:py-11">
          <div className="max-w-2xl text-white">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden />Skincare, made simple</p>
            <h1 className="font-display text-[2rem] leading-[1.12] sm:text-4xl md:text-[2.5rem]">Honest formulas for skin that feels like yours.</h1>
            <p className="mt-3 max-w-md text-white/85">A short list of well-made essentials, designed to work together and delivered to the UK and Ghana.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/shop" className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 font-semibold text-ink transition hover:bg-white">Shop now <ArrowIcon /></Link>
              <Link href="/shop?collection=best" className="rounded-lg border border-white bg-white/15 px-6 py-2.5 font-medium text-white backdrop-blur-sm transition hover:bg-white hover:text-ink">Best sellers</Link>
            </div>
          </div>
        </div>
      </section>

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

      {/* Shop by concern: how most people think about skincare */}
      <section className="pt-14">
        <h2 className="mb-6 font-display text-2xl sm:text-3xl">Shop by skin concern</h2>
        <ul className="flex flex-wrap gap-3">
          {concernCounts(PRODUCTS).slice(0, 8).map((c) => (
            <li key={c.concern}>
              <Link
                href={`/shop?concern=${encodeURIComponent(c.concern)}`}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-card px-5 text-sm font-medium transition hover:border-brand hover:bg-brand/10"
              >
                {c.concern}
                <span className="text-xs font-normal text-muted">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
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
