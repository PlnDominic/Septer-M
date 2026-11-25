import Link from 'next/link';
import { allShippingOptions, DISPATCH_CUTOFF_HOUR, FREE_SHIPPING_OVER } from '@septer-m/shared';
import { PolicyPage } from '@/components/policy';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Delivery', description: 'Delivery costs, times and free-delivery thresholds for the UK and Ghana.' };

const cutoff = `${DISPATCH_CUTOFF_HOUR - 12}pm`;

export default function Shipping() {
  const markets = [
    { name: 'United Kingdom', currency: 'GBP' as const, options: allShippingOptions('UK') },
    { name: 'Ghana', currency: 'GHS' as const, options: allShippingOptions('GH') },
  ];
  return (
    <PolicyPage title="Delivery" intro="What delivery costs and when it arrives, shown before you pay.">
      <p>We deliver to addresses in the United Kingdom and Ghana. Prices are set separately for each market and shown in pounds (£) for the UK and Ghana cedis (GH₵) for Ghana.</p>

      {markets.map((m) => (
        <section key={m.name}>
          <h2>{m.name}</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-mist text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2.5">Option</th><th className="px-4 py-2.5">Arrives</th><th className="px-4 py-2.5 text-right">Cost</th></tr>
              </thead>
              <tbody>
                {m.options.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{o.label}</td>
                    <td className="px-4 py-3">{o.detail}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(o.price, m.currency)}{o.freeOver ? <span className="block text-xs text-muted">Free over {formatMoney(o.freeOver, m.currency)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2>How the times work</h2>
      <ul>
        <li>Working days are Monday to Friday, excluding public holidays.</li>
        <li>Orders placed before {cutoff} on a working day are dispatched that day. Orders placed after {cutoff}, or at a weekend, are dispatched the next working day.</li>
        <li>Delivery times start from dispatch and are estimates. On the product page and in your bag you’ll see an expected arrival date for your market.</li>
        <li>Free delivery applies once your products total {formatMoney(FREE_SHIPPING_OVER.GBP, 'GBP')} or more in the UK ({formatMoney(FREE_SHIPPING_OVER.GHS, 'GHS')} in Ghana), before delivery. It applies to standard delivery in the UK and to all delivery in Ghana.</li>
      </ul>

      <h2>Delivery in Ghana</h2>
      <p>Please give a phone number that is switched on: the delivery rider may call you to confirm your location. A GhanaPostGPS digital address and a nearby landmark help the rider find you.</p>

      <h2>Problems with your delivery</h2>
      <p>If your order is late, damaged or missing, get in touch from the <Link href="/contact">Contact page</Link> with your order number and we’ll sort it out. See also our <Link href="/returns">returns policy</Link>.</p>
    </PolicyPage>
  );
}
