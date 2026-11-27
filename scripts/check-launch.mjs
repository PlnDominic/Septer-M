// Lists what still has to be filled in before the shop can go live. Run: pnpm check:launch
import { readFileSync, existsSync } from 'node:fs';

const env = { ...Object.fromEntries((existsSync('.env') ? readFileSync('.env', 'utf8') : '').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])), ...process.env };
const has = (k) => Boolean(env[k] && String(env[k]).trim());

const checks = [
  ['Support email or WhatsApp (Contact page)', has('NEXT_PUBLIC_SUPPORT_EMAIL') || has('NEXT_PUBLIC_WHATSAPP'), 'NEXT_PUBLIC_SUPPORT_EMAIL / NEXT_PUBLIC_WHATSAPP'],
  ['Registered company name', has('NEXT_PUBLIC_BUSINESS_LEGAL_NAME'), 'NEXT_PUBLIC_BUSINESS_LEGAL_NAME'],
  ['Company number', has('NEXT_PUBLIC_COMPANY_NUMBER'), 'NEXT_PUBLIC_COMPANY_NUMBER'],
  ['Business address', has('NEXT_PUBLIC_BUSINESS_ADDRESS'), 'NEXT_PUBLIC_BUSINESS_ADDRESS'],
  ['Public site address (sitemap, share previews)', has('NEXT_PUBLIC_SITE_URL') && !/localhost/.test(env.NEXT_PUBLIC_SITE_URL), 'NEXT_PUBLIC_SITE_URL'],
  ['Supabase connected (sign-in)', has('NEXT_PUBLIC_SUPABASE_URL') && has('NEXT_PUBLIC_SUPABASE_ANON_KEY'), 'NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY'],
  ['API configured', has('SUPABASE_SERVICE_ROLE_KEY') && has('SUPABASE_URL'), 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'],
  ['Storefront pointed at the API (otherwise it runs in demo mode)', has('NEXT_PUBLIC_API_URL') && !/localhost/.test(env.NEXT_PUBLIC_API_URL ?? ''), 'NEXT_PUBLIC_API_URL'],
  ['API knows the storefront address (payment returns, email links)', has('WEB_URL') && !/localhost/.test(env.WEB_URL ?? ''), 'WEB_URL'],
  ['Scheduled job secret (releases unpaid reservations)', has('CRON_SECRET') && String(env.CRON_SECRET).length >= 16, 'CRON_SECRET'],
  ['Stripe (UK payments)', has('STRIPE_SECRET_KEY') && has('STRIPE_WEBHOOK_SECRET'), 'STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET'],
  ['Paystack (Ghana payments)', has('PAYSTACK_SECRET_KEY'), 'PAYSTACK_SECRET_KEY'],
  ['Order emails (Resend)', has('RESEND_API_KEY') && has('EMAIL_FROM'), 'RESEND_API_KEY / EMAIL_FROM'],
];
const manual = [
  'Read the Delivery, Returns, Privacy and Terms pages and confirm they match how you really operate (have a solicitor check them).',
  'Confirm delivery prices, free-delivery thresholds, the 1pm cutoff and the 30-day returns window (apps/web/src/lib/site.ts, packages/shared/src/checkout.ts).',
  'Confirm how import duties / VAT are handled for UK to Ghana orders, and add it to the Delivery page.',
  'Run supabase/setup.sql (new project) or the newest files in supabase/migrations (existing project) on your Supabase database, then make yourself admin (see README).',
  'Add the Stripe and Paystack webhook URLs in each dashboard and check a real test payment marks an order Paid (README: Payments).',
  'Verify your sending domain in Resend, place a test order and check the confirmation email arrives (and is not in spam).',
  'Mobile Money: test each network (MTN, Telecel, AirtelTigo) with a small real payment. Telecel/Vodafone approval prompts vary and could not be verified in advance.',
  'Replace stock photography with your own product photos (apps/web/public/images/CREDITS.md).',
  'Reviews: ratings stay hidden until verified reviews exist. Approve them in Admin > Reviews. Do not add placeholder ratings.',
  'Set stock numbers in Admin > Products (the seed numbers are placeholders).',
  '"Best sellers" is a manual flag in Admin > Products, not computed from sales.',
  'UK addresses: the postcode check only catches typos. Full street-address lookup needs a paid service (e.g. getAddress.io); not included.',
  'Vercel cron on the free plan runs at most daily, so unpaid reservations can hold stock for up to a day. Use a Pro plan or an external scheduler hitting /v1/internal/release-expired every few minutes.',
];
let missing = 0;
console.log('\nLaunch readiness\n');
for (const [label, ok, key] of checks) { console.log(`${ok ? '  ok ' : '  TODO'}  ${label}${ok ? '' : `   (${key})`}`); if (!ok) missing++; }
console.log('\nStill to do by hand:');
for (const m of manual) console.log(`  -  ${m}`);
console.log(`\n${missing} configuration item${missing === 1 ? '' : 's'} missing, ${manual.length} manual checks.\n`);
