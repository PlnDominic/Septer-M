import Link from 'next/link';
import Image from 'next/image';

export const metadata = { title: 'About', description: 'Septer-M makes a short list of skincare essentials with full ingredient lists, delivered to the UK and Ghana.' };

const principles = [
  { title: 'A short list that works together', body: 'Instead of a hundred products, a focused range of cleansers, serums, moisturisers, sunscreen and masks that fit into one simple routine.' },
  { title: 'Nothing hidden', body: 'Every product page shows the full ingredient list (INCI), how to use it and which skin types and concerns it’s for.' },
  { title: 'Priced for where you live', body: 'We set prices separately for the UK and Ghana instead of converting at a glance, and show delivery costs and arrival dates before you pay.' },
  { title: 'Paid the way you pay', body: 'Cards, Apple Pay and Google Pay in the UK; Mobile Money and cards in Ghana.' },
];

export default function About() {
  return (
    <div className="mx-auto max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl">About Septer-M</h1>
      <p className="mt-3 text-lg text-muted">Skincare, made simple, for the UK and Ghana.</p>

      <div className="relative mt-8 aspect-[16/7] overflow-hidden rounded-2xl bg-line">
        <Image src="/images/lifestyle/routine.jpg" alt="Woman in profile with glowing skin" fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover object-[50%_30%]" />
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {principles.map((p) => (
          <div key={p.title} className="rounded-2xl border border-line p-5">
            <h2 className="text-base">{p.title}</h2>
            <p className="mt-2 text-sm text-muted">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/shop" className="rounded-full bg-ink px-6 py-3 font-medium text-white transition hover:bg-brand hover:text-ink">Shop the range</Link>
        <Link href="/contact" className="rounded-full border border-line px-6 py-3 font-medium transition hover:border-ink">Get in touch</Link>
      </div>
    </div>
  );
}
