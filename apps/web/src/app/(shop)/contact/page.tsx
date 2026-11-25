import Link from 'next/link';
import { BUSINESS, hasContactMethod, registeredLine, whatsappUrl } from '@/lib/business';

export const metadata = { title: 'Contact', description: 'Get in touch with Septer-M about an order, delivery or your skin.' };

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-line p-5">
    <h2 className="text-base">{title}</h2>
    <div className="mt-2 text-sm text-muted">{children}</div>
  </div>
);

export default function Contact() {
  const registered = registeredLine();
  return (
    <div className="mx-auto max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl">Contact us</h1>
      <p className="mt-3 text-lg text-muted">Questions about an order, delivery or choosing a product? We’re happy to help.</p>

      {hasContactMethod ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {BUSINESS.supportEmail && (
            <Card title="Email">
              <a href={`mailto:${BUSINESS.supportEmail}`} className="font-medium text-ink underline">{BUSINESS.supportEmail}</a>
              <p className="mt-1">Include your order number if you have one.</p>
            </Card>
          )}
          {BUSINESS.whatsapp && (
            <Card title="WhatsApp">
              <a href={whatsappUrl('Hello Septer-M, I have a question')} className="font-medium text-ink underline" rel="noopener">Message us on WhatsApp</a>
              <p className="mt-1">Quick answers, and easy for Ghana customers.</p>
            </Card>
          )}
          {BUSINESS.supportHours && <Card title="Opening hours">{BUSINESS.supportHours}</Card>}
        </div>
      ) : (
        <p role="note" className="mt-8 rounded-xl border border-brand bg-brand/10 px-4 py-3 text-sm">
          Our contact details are being added. In the meantime, sign in to your <Link href="/account" className="underline">account</Link> to see your orders.
        </p>
      )}

      <h2 className="mt-12 mb-3 text-xl">Quick answers</h2>
      <ul className="space-y-1.5 text-sm underline">
        <li><Link href="/shipping">How much is delivery, and when will it arrive?</Link></li>
        <li><Link href="/returns">How do I return something?</Link></li>
        <li><Link href="/faq">Payments, Mobile Money and your account</Link></li>
      </ul>

      {registered && <p className="mt-12 border-t border-line pt-6 text-xs text-muted">{registered}</p>}
    </div>
  );
}
