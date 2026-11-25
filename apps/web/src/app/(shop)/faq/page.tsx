import type { ReactNode } from 'react';
import Link from 'next/link';
import { allShippingOptions, FREE_SHIPPING_OVER } from '@septer-m/shared';
import { PolicyPage } from '@/components/policy';
import { formatMoney } from '@/lib/money';
import { RETURN_DAYS } from '@/lib/site';

export const metadata = { title: 'FAQ', description: 'Answers about delivery, returns, payments and using Septer-M skincare.' };

const uk = allShippingOptions('UK');
const gh = allShippingOptions('GH');

const groups: { title: string; items: { q: string; a: ReactNode }[] }[] = [
  {
    title: 'Delivery',
    items: [
      { q: 'Where do you deliver?', a: 'To addresses in the United Kingdom and Ghana.' },
      {
        q: 'How much is delivery and how long does it take?',
        a: (
          <>
            UK: {uk[0].label.toLowerCase()} {formatMoney(uk[0].price, 'GBP')} ({uk[0].detail}), free over {formatMoney(FREE_SHIPPING_OVER.GBP, 'GBP')}; {uk[1].label.toLowerCase()} {formatMoney(uk[1].price, 'GBP')}. Ghana: {gh[0].label} {formatMoney(gh[0].price, 'GHS')} ({gh[0].detail}); elsewhere in Ghana {formatMoney(gh[1].price, 'GHS')} ({gh[1].detail}); free over {formatMoney(FREE_SHIPPING_OVER.GHS, 'GHS')}. See <Link href="/shipping">Delivery</Link> for details.
          </>
        ),
      },
      { q: 'When will my order arrive?', a: 'You’ll see an expected arrival date on every product page and in your bag. Dates are estimates, count working days (Monday to Friday) and exclude public holidays.' },
      { q: 'Will I find out the delivery cost before I pay?', a: 'Yes. It’s shown on the product page, in your bag and again at checkout before you place your order.' },
    ],
  },
  {
    title: 'Returns',
    items: [
      { q: 'Can I return a product?', a: <>Yes. Unopened, unused products can be returned within {RETURN_DAYS} days of delivery. See <Link href="/returns">Returns &amp; refunds</Link>.</> },
      { q: 'What if it arrives damaged or isn’t right?', a: 'Contact us with your order number and a photo and we’ll replace it or refund you.' },
      { q: 'Why can’t I return opened skincare?', a: 'For hygiene and safety, opened or used products can’t be resold. Faulty or not-as-described items are always covered.' },
    ],
  },
  {
    title: 'Payments',
    items: [
      { q: 'How can I pay?', a: 'In the UK: card, Apple Pay and Google Pay. In Ghana: Mobile Money (MTN MoMo, Telecel Cash, AirtelTigo Money) or card.' },
      { q: 'Is it safe to pay?', a: 'Payments are handled by our payment providers, Stripe and Paystack. We never see or store your card details.' },
      { q: 'How does Mobile Money work?', a: 'Choose your network and enter your Mobile Money number. You’ll get a prompt on your phone to approve the payment with your PIN. If you don’t approve it in time, the order is cancelled and nothing is charged.' },
    ],
  },
  {
    title: 'Products',
    items: [
      { q: 'Where can I see the ingredients?', a: 'Every product page lists the full ingredients (INCI) and how to use it.' },
      { q: 'How do I know which product suits my skin?', a: 'Each product page shows the skin types and concerns it’s made for. Always patch test before first use and stop if irritation occurs. If you’re unsure, ask us on the Contact page.' },
      { q: 'I’m pregnant, breastfeeding or have a skin condition. Is it safe?', a: 'Please check the ingredients with your doctor or pharmacist before using a new skincare product.' },
    ],
  },
  {
    title: 'Your account',
    items: [
      { q: 'Do I need an account to order?', a: 'No, you can check out as a guest. An account lets you see your order history; you can sign up with email or Google.' },
      { q: 'I forgot my password.', a: <>Use “Forgot your password?” on the <Link href="/account">sign-in page</Link> and we’ll email you a reset link.</> },
    ],
  },
];

export default function Faq() {
  return (
    <PolicyPage title="Frequently asked questions" updated={false}>
      {groups.map((g) => (
        <section key={g.title}>
          <h2>{g.title}</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {g.items.map((i) => (
              <details key={i.q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {i.q}
                  <span aria-hidden className="text-xl transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-muted">{i.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p>Can’t find your answer? <Link href="/contact">Contact us</Link>.</p>
    </PolicyPage>
  );
}
