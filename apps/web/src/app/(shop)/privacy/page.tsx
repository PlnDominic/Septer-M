import Link from 'next/link';
import { PolicyPage } from '@/components/policy';
import { BUSINESS } from '@/lib/business';

export const metadata = { title: 'Privacy policy', description: 'What personal data Septer-M collects, why, and your rights.' };

export default function Privacy() {
  const controller = BUSINESS.legalName ?? BUSINESS.name;
  return (
    <PolicyPage title="Privacy policy" intro="What we collect, why we collect it and what you can do about it.">
      <p>{controller} (“we”, “us”) runs the {BUSINESS.name} online shop and is responsible for your personal data. You can reach us through the <Link href="/contact">Contact page</Link>{BUSINESS.supportEmail ? <> or at <a href={`mailto:${BUSINESS.supportEmail}`}>{BUSINESS.supportEmail}</a></> : null}.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Orders:</strong> your name, email, delivery address, phone number and what you bought. For Mobile Money, the number and network you give us so the payment prompt can be sent.</li>
        <li><strong>Your account:</strong> your email, name and password (stored securely by our sign-in provider, never in readable form). If you sign in with Google, we receive your name and email address from Google.</li>
        <li><strong>On your device:</strong> your bag, wishlist, chosen country and sign-in session are saved in your browser so the shop works. We don’t use advertising or analytics cookies at the moment; if that changes we’ll ask first.</li>
        <li><strong>Payments:</strong> card payments are handled by Stripe and Paystack. We never see or store your card number.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To take, deliver and support your order (this is necessary to carry out our contract with you).</li>
        <li>To keep our records and meet tax and legal duties.</li>
        <li>To prevent fraud and keep the shop secure.</li>
        <li>To send you marketing email only if you’ve asked for it. You can unsubscribe at any time.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>Only the companies that help us run the shop, and only what they need: our database and sign-in provider (Supabase), our website host (Vercel), payment providers (Stripe, Paystack), Google (if you choose Google sign-in) and delivery partners who need your name, address and phone number to reach you. We never sell your data.</p>

      <h2>Transfers abroad</h2>
      <p>Some of these providers handle data outside the UK and Ghana. Where they do, we use providers that protect it to an appropriate standard.</p>

      <h2>How long we keep it</h2>
      <p>Order and payment records are kept for as long as the law requires for tax and accounting (usually six years in the UK). Account details are kept until you ask us to delete your account.</p>

      <h2>Your rights</h2>
      <p>You can ask to see, correct, export or delete your personal data, object to how we use it, or withdraw consent, by contacting us. If you’re unhappy with our response you can complain to the Information Commissioner’s Office (UK) or the Data Protection Commission (Ghana).</p>

      <h2>Changes</h2>
      <p>If we change this policy we’ll update the date at the top of this page.</p>
    </PolicyPage>
  );
}
