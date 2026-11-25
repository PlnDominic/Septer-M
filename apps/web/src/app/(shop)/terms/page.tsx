import Link from 'next/link';
import { PolicyPage } from '@/components/policy';
import { BUSINESS, registeredLine } from '@/lib/business';
import { RETURN_DAYS } from '@/lib/site';

export const metadata = { title: 'Terms & conditions', description: 'The terms that apply when you order from Septer-M.' };

export default function Terms() {
  const registered = registeredLine();
  return (
    <PolicyPage title="Terms & conditions" intro="The simple version: what you can expect from us and what we expect from you.">
      <h2>Who we are</h2>
      <p>{registered ?? `${BUSINESS.name} is an online skincare shop.`} Contact us through the <Link href="/contact">Contact page</Link>.</p>

      <h2>Ordering</h2>
      <ul>
        <li>When you place an order we send an order confirmation. Our contract with you starts when we dispatch your products. We may decline an order, for example if a product is out of stock or a price is clearly wrong, and if so we’ll tell you and refund anything you’ve paid.</li>
        <li>Stock is reserved while you complete payment. If payment isn’t completed in time, the order is cancelled and the stock is released.</li>
      </ul>

      <h2>Prices and currency</h2>
      <p>Prices are shown in pounds (£) for the UK and Ghana cedis (GH₵) for Ghana, and are set separately for each market. The price you see at checkout, including delivery, is the price you pay.</p>

      <h2>Payment</h2>
      <p>You can pay by the methods shown at checkout. Payments are processed securely by Stripe and Paystack.</p>

      <h2>Delivery and returns</h2>
      <p>Delivery costs and times are on our <Link href="/shipping">Delivery page</Link>. You can return unopened products within {RETURN_DAYS} days under our <Link href="/returns">returns policy</Link>. Risk in the products passes to you on delivery.</p>

      <h2>Using our products</h2>
      <p>Follow the instructions on each product page and patch test before first use. Stop using a product if irritation occurs. Our products are cosmetics, not medicines, and we don’t make medical claims.</p>

      <h2>Your account</h2>
      <p>Keep your sign-in details private. Tell us straight away if you think someone else has used your account.</p>

      <h2>Our responsibility to you</h2>
      <p>Nothing in these terms limits your legal rights as a consumer, or our liability for things we can’t lawfully limit, such as death or personal injury caused by our negligence, or fraud. Otherwise we’re responsible for foreseeable loss caused by our breach of these terms.</p>

      <h2>Law</h2>
      <p>These terms are governed by the law of England and Wales. If you live in Ghana you also keep the protection of the mandatory consumer laws there.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The version in force when you place an order is the one that applies to it.</p>
    </PolicyPage>
  );
}
