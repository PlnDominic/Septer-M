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
];
const manual = [
  'Read the Delivery, Returns, Privacy and Terms pages and confirm they match how you really operate (have a solicitor check them).',
  'Confirm delivery prices, free-delivery thresholds, the 1pm cutoff and the 30-day returns window (apps/web/src/lib/site.ts, packages/shared/src/checkout.ts).',
  'Confirm how import duties / VAT are handled for UK to Ghana orders, and add it to the Delivery page.',
  'Build order emails (confirmation, dispatch): the FAQ and checkout say customers receive them.',
  'Replace stock photography with your own product photos (apps/web/public/images/CREDITS.md).',
  'Real reviews: ratings are hidden until verified reviews exist. Do not add placeholder ratings.',
  'Lock the /admin pages behind sign-in with the admin role.',
  'Connect payments (Stripe, Paystack): checkout currently records orders in test mode only.',
];
let missing = 0;
console.log('\nLaunch readiness\n');
for (const [label, ok, key] of checks) { console.log(`${ok ? '  ok ' : '  TODO'}  ${label}${ok ? '' : `   (${key})`}`); if (!ok) missing++; }
console.log('\nStill to do by hand:');
for (const m of manual) console.log(`  -  ${m}`);
console.log(`\n${missing} configuration item${missing === 1 ? '' : 's'} missing, ${manual.length} manual checks.\n`);
