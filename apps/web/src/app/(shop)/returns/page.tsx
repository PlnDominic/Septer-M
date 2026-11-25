import Link from 'next/link';
import { PolicyPage } from '@/components/policy';
import { RETURN_DAYS } from '@/lib/site';

export const metadata = { title: 'Returns & refunds', description: 'How to return a Septer-M product and when you get your money back.' };

export default function Returns() {
  return (
    <PolicyPage title="Returns & refunds" intro={`Changed your mind? You have ${RETURN_DAYS} days from delivery to return unopened products.`}>
      <h2>Returning an unopened product</h2>
      <ul>
        <li>Tell us within {RETURN_DAYS} days of delivery that you want to return it, using the <Link href="/contact">Contact page</Link> and your order number.</li>
        <li>The product must be unopened, unused and in its original packaging.</li>
        <li>We’ll confirm where to send it. Unless the item was faulty or our mistake, you pay the cost of sending it back, so keep your proof of postage.</li>
        <li>Once we receive and check it, we refund the price of the products to your original payment method within 14 days. Delivery charges are refunded only if you return the whole order.</li>
      </ul>

      <h2>Opened or used products</h2>
      <p>For hygiene and safety reasons we can’t take back skincare that has been opened or used, unless it is faulty or not as described. This doesn’t affect your legal rights.</p>

      <h2>Faulty, damaged or wrong items</h2>
      <p>If something arrives damaged, leaking, faulty or isn’t what you ordered, contact us as soon as you can with your order number and a photo. We’ll replace it or refund you, including the cost of returning it if we ask for it back.</p>

      <h2>Skin reactions</h2>
      <p>Everyone’s skin is different. We recommend a patch test before first use, and stopping use if irritation occurs. If you have a reaction, stop using the product and contact us; if it is serious, see a doctor or pharmacist.</p>

      <h2>Cancelled before dispatch</h2>
      <p>If your order hasn’t been dispatched yet, contact us right away and we’ll cancel it and refund you in full.</p>

      <h2>Your legal rights</h2>
      <p>Nothing in this policy takes away your statutory consumer rights in the UK or Ghana.</p>
    </PolicyPage>
  );
}
