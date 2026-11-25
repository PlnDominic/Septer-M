// Runs the real migrations + seed against an in-process Postgres (PGlite) with
// minimal stand-ins for Supabase's auth schema and roles. Run: pnpm test:db
import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = (f) => readFileSync(join(root, f), 'utf8');

const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const ALICE = '00000000-0000-0000-0000-0000000000b1';
const BOB = '00000000-0000-0000-0000-0000000000b2';

const UK_ADDRESS = { firstName: 'Ada', lastName: 'Lovelace', line1: '1 High St', city: 'London', postcode: 'SW1A 1AA' };
const CARD = { method: 'card' };

let db;

/** Run a callback as a given Postgres role, optionally impersonating a Supabase user. */
async function as(role, userId, fn) {
  await db.exec(`set role ${role}`);
  if (userId) await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false)`);
  }
}

const q = async (text, params) => (await db.query(text, params)).rows;
const one = async (text, params) => (await q(text, params))[0];

async function stock(slug) {
  return (await one('select stock from public.products where slug = $1', [slug])).stock;
}

function placeOrder({ items, region = 'UK', subtotal, shippingCost = 395, email = 'ada@example.com', userId = null, ttl = 30, discountCode = null, expectedDiscount = null }) {
  return db.query(
    `select public.create_order($1, $2, $3::public.region_code, $4::jsonb, 'uk-standard', 'Standard delivery', '2-4 working days',
                                $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11) as r`,
    [userId, email, region, JSON.stringify(UK_ADDRESS), shippingCost, JSON.stringify(CARD), JSON.stringify(items), subtotal, ttl, discountCode, expectedDiscount],
  );
}

/** Assert a statement fails with a given machine code (and optional detail). */
async function rejects(promise, code, detail) {
  await assert.rejects(promise, (e) => {
    assert.equal(e.message, code);
    if (detail) assert.equal(e.detail, detail);
    return true;
  });
}

before(async () => {
  db = new PGlite();
  // Stand-ins for what Supabase provides.
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
  `);
  for (const f of readdirSync(join(root, 'migrations')).sort()) await db.exec(sql(`migrations/${f}`));
  await db.exec(sql('seed.sql'));

  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN}', 'admin@example.com'), ('${ALICE}', 'alice@example.com'), ('${BOB}', 'bob@example.com');
    update public.profiles set role = 'admin' where id = '${ADMIN}';
  `);
});

describe('schema + seed', () => {
  test('seed loads the catalogue idempotently', async () => {
    assert.equal((await one('select count(*)::int n from public.products')).n, 8);
    assert.equal((await one('select count(*)::int n from public.product_prices')).n, 16);
    await db.exec(sql('seed.sql')); // re-run
    assert.equal((await one('select count(*)::int n from public.products')).n, 8);
    assert.equal((await one('select count(*)::int n from public.product_prices')).n, 16);
  });

  test('sale price is kept per currency', async () => {
    const p = await one(`select compare_at from public.product_prices pp join public.products p on p.id = pp.product_id
                         where p.slug = 'clay-purifying-mask' and pp.currency = 'GBP'`);
    assert.equal(p.compare_at, 2000);
  });

  test('new auth users get a customer profile', async () => {
    const p = await one(`select role from public.profiles where id = '${ALICE}'`);
    assert.equal(p.role, 'customer');
  });

  test('profile name comes from full_name (email sign-up) or name (Google)', async () => {
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
      ('00000000-0000-0000-0000-0000000000c1', 'email@example.com', '{"full_name":"Email Person"}'),
      ('00000000-0000-0000-0000-0000000000c2', 'google@example.com', '{"name":"Google Person","avatar_url":"x"}'),
      ('00000000-0000-0000-0000-0000000000c3', 'none@example.com', null)`);
    const names = await q(`select email, full_name from public.profiles where email in ('email@example.com','google@example.com','none@example.com') order by email`);
    assert.deepEqual(names, [
      { email: 'email@example.com', full_name: 'Email Person' },
      { email: 'google@example.com', full_name: 'Google Person' },
      { email: 'none@example.com', full_name: null },
    ]);
  });

  test('constraints reject bad data', async () => {
    await assert.rejects(db.exec(`insert into public.products (slug, name, category_id, size_ml)
      select 'Bad Slug', 'x', id, 10 from public.categories limit 1`));
    await assert.rejects(db.exec(`update public.products set stock = -1 where slug = 'gentle-gel-cleanser'`));
    await assert.rejects(db.exec(`update public.product_prices set compare_at = 1 where compare_at is null`));
  });
});

describe('create_order', () => {
  test('creates the order, reserves stock and snapshots prices', async () => {
    const before = await stock('vitamin-c-brightening-serum');
    const { rows } = await placeOrder({
      items: [{ slug: 'vitamin-c-brightening-serum', qty: 2 }, { slug: 'gentle-gel-cleanser', qty: 1 }],
      subtotal: 2800 * 2 + 1400,
    });
    const r = rows[0].r;
    assert.match(r.number, /^SM-\d+$/);
    assert.equal(r.subtotal, 7000);
    assert.equal(r.total, 7395);
    assert.equal(r.currency, 'GBP');
    assert.equal(await stock('vitamin-c-brightening-serum'), before - 2);

    const items = await q(`select slug, qty, unit_price from public.order_items i join public.orders o on o.id = i.order_id
                           where o.number = $1 order by slug`, [r.number]);
    assert.deepEqual(items, [
      { slug: 'gentle-gel-cleanser', qty: 1, unit_price: 1400 },
      { slug: 'vitamin-c-brightening-serum', qty: 2, unit_price: 2800 },
    ]);
    const o = await one('select status, expires_at, email from public.orders where number = $1', [r.number]);
    assert.equal(o.status, 'pending_payment');
    assert.ok(o.expires_at);
    assert.equal((await one('select count(*)::int n from public.order_events where order_id = $1', [r.id])).n, 1);
    assert.equal((await one('select count(*)::int n from public.inventory_movements where order_id = $1', [r.id])).n, 2);
  });

  test('prices Ghana orders in GHS', async () => {
    const { rows } = await db.query(
      `select public.create_order(null, 'kofi@example.com', 'GH', '{"firstName":"Kofi"}'::jsonb, 'gh-accra', 'Accra delivery', '1-2 days',
         3500, '{"method":"momo","network":"mtn","phone":"+233241234567"}'::jsonb, '[{"slug":"daily-sunscreen-spf-50","qty":1}]'::jsonb, 21000, 30) as r`);
    assert.equal(rows[0].r.currency, 'GHS');
    assert.equal(rows[0].r.total, 24500);
  });

  test('merges duplicate lines for the same product', async () => {
    const before = await stock('daily-sunscreen-spf-50');
    await placeOrder({ items: [{ slug: 'daily-sunscreen-spf-50', qty: 1 }, { slug: 'daily-sunscreen-spf-50', qty: 2 }], subtotal: 1600 * 3 });
    assert.equal(await stock('daily-sunscreen-spf-50'), before - 3);
  });

  test('rejects an empty cart', async () => {
    await rejects(placeOrder({ items: [], subtotal: 0 }), 'EMPTY_CART');
  });

  test('rejects more than available stock and leaves stock untouched', async () => {
    const s = await stock('light-gel-moisturiser'); // 3 in seed
    await rejects(placeOrder({ items: [{ slug: 'light-gel-moisturiser', qty: 4 }], subtotal: 1900 * 4 }), 'OUT_OF_STOCK', 'light-gel-moisturiser');
    assert.equal(await stock('light-gel-moisturiser'), s);
  });

  test('rejects out-of-stock and unknown products', async () => {
    await rejects(placeOrder({ items: [{ slug: 'clay-purifying-mask', qty: 1 }], subtotal: 1700 }), 'OUT_OF_STOCK', 'clay-purifying-mask');
    await rejects(placeOrder({ items: [{ slug: 'nope', qty: 1 }], subtotal: 100 }), 'PRODUCT_UNAVAILABLE', 'nope');
  });

  test('rejects draft products', async () => {
    await db.exec(`update public.products set status = 'draft' where slug = 'overnight-hydration-mask'`);
    await rejects(placeOrder({ items: [{ slug: 'overnight-hydration-mask', qty: 1 }], subtotal: 2400 }), 'PRODUCT_UNAVAILABLE');
    await db.exec(`update public.products set status = 'active' where slug = 'overnight-hydration-mask'`);
  });

  test('rejects a stale subtotal (price changed mid-checkout) without side effects', async () => {
    const s = await stock('barrier-repair-moisturiser');
    const orders = (await one('select count(*)::int n from public.orders')).n;
    await rejects(placeOrder({ items: [{ slug: 'barrier-repair-moisturiser', qty: 1 }], subtotal: 1 }), 'PRICE_CHANGED', '2200');
    assert.equal(await stock('barrier-repair-moisturiser'), s);
    assert.equal((await one('select count(*)::int n from public.orders')).n, orders);
  });

  test('rejects invalid quantities', async () => {
    await rejects(placeOrder({ items: [{ slug: 'gentle-gel-cleanser', qty: 0 }], subtotal: 0 }), 'INVALID_QUANTITY');
    await rejects(placeOrder({ items: [{ slug: 'gentle-gel-cleanser', qty: 21 }], subtotal: 0 }), 'INVALID_QUANTITY');
  });
});

describe('order lifecycle', () => {
  async function newOrder(slug = 'niacinamide-clarifying-serum', price = 1800) {
    const { rows } = await placeOrder({ items: [{ slug, qty: 1 }], subtotal: price });
    return rows[0].r;
  }
  const setStatus = (number, status, note = null) =>
    db.query('select public.set_order_status($1, $2::public.order_status, $3, $4) as r', [number, status, note, ADMIN]);

  test('walks the happy path and records history', async () => {
    const o = await newOrder();
    for (const s of ['paid', 'processing', 'shipped', 'delivered']) await setStatus(o.number, s, s === 'shipped' ? 'TRK123' : null);
    const events = await q(`select e.status, e.note from public.order_events e join public.orders x on x.id = e.order_id
                            where x.number = $1 order by e.created_at, e.id`, [o.number]);
    assert.deepEqual(events.map((e) => e.status), ['pending_payment', 'paid', 'processing', 'shipped', 'delivered']);
    assert.equal(events[3].note, 'TRK123');
  });

  test('rejects illegal transitions', async () => {
    const o = await newOrder();
    await rejects(setStatus(o.number, 'shipped'), 'INVALID_TRANSITION', 'pending_payment -> shipped');
    await setStatus(o.number, 'cancelled');
    await rejects(setStatus(o.number, 'paid'), 'INVALID_TRANSITION');
    await rejects(setStatus('SM-DOESNOTEXIST', 'paid'), 'ORDER_NOT_FOUND');
  });

  test('cancelling before shipment returns stock; refunding after delivery does not', async () => {
    const s0 = await stock('niacinamide-clarifying-serum');
    const a = await newOrder();
    assert.equal(await stock('niacinamide-clarifying-serum'), s0 - 1);
    await setStatus(a.number, 'cancelled');
    assert.equal(await stock('niacinamide-clarifying-serum'), s0);

    const b = await newOrder();
    for (const s of ['paid', 'processing', 'shipped', 'delivered', 'refunded']) await setStatus(b.number, s);
    assert.equal(await stock('niacinamide-clarifying-serum'), s0 - 1);
  });

  test('mark_order_paid is idempotent and checks the amount', async () => {
    const o = await newOrder();
    const pay = (ref, amount = 2195, currency = 'GBP') =>
      db.query(`select public.mark_order_paid($1, 'stripe', $2, $3, $4::public.currency_code, '{}'::jsonb) as r`, [o.number, ref, amount, currency]);

    const bad = (await pay('pi_wrong', 100)).rows[0].r;
    assert.equal(bad.mismatch, true);
    assert.equal((await one('select status from public.orders where number = $1', [o.number])).status, 'pending_payment');

    assert.equal((await pay('pi_1')).rows[0].r.status, 'paid');
    const again = (await pay('pi_1')).rows[0].r;
    assert.equal(again.duplicate, true);
    assert.equal((await one(`select count(*)::int n from public.payments p join public.orders x on x.id = p.order_id
                             where x.number = $1 and p.status = 'succeeded'`, [o.number])).n, 1);
    assert.equal((await one('select expires_at from public.orders where number = $1', [o.number])).expires_at, null);
  });

  test('payment arriving after cancellation is recorded and flagged, not applied', async () => {
    const o = await newOrder();
    await setStatus(o.number, 'cancelled');
    const r = (await db.query(`select public.mark_order_paid($1, 'paystack', 'ref_late', 2195, 'GBP', null) as r`, [o.number])).rows[0].r;
    assert.equal(r.review, true);
    assert.equal((await one('select status from public.orders where number = $1', [o.number])).status, 'cancelled');
  });

  test('release_expired_orders cancels unpaid orders and restocks, leaving others alone', async () => {
    const s0 = await stock('overnight-hydration-mask');
    const expired = (await placeOrder({ items: [{ slug: 'overnight-hydration-mask', qty: 2 }], subtotal: 4800, ttl: -5 })).rows[0].r;
    const fresh = (await placeOrder({ items: [{ slug: 'overnight-hydration-mask', qty: 1 }], subtotal: 2400, ttl: 30 })).rows[0].r;
    assert.equal(await stock('overnight-hydration-mask'), s0 - 3);

    const released = (await one('select public.release_expired_orders() as n')).n;
    assert.ok(released >= 1);
    assert.equal((await one('select status from public.orders where number = $1', [expired.number])).status, 'cancelled');
    assert.equal((await one('select status from public.orders where number = $1', [fresh.number])).status, 'pending_payment');
    assert.equal(await stock('overnight-hydration-mask'), s0 - 1);
    assert.equal((await one('select public.release_expired_orders() as n')).n, 0);
  });
});

describe('admin functions', () => {
  const product = (over = {}) => ({
    slug: 'rose-toner', name: 'Rose Hydrating Toner', tagline: 'Soothes', category: 'serum', sizeMl: 100,
    price: { GBP: 1600, GHS: 21000 }, skinTypes: ['All'], concerns: ['Dryness'], ingredients: 'Aqua, Rosa Damascena',
    howToUse: 'Pat on.', imagePath: '/images/products/gentle-gel-cleanser.jpg', isNew: true, bestSeller: false,
    status: 'active', stock: 25, ...over,
  });
  const upsert = (p, original = null) => db.query('select public.admin_upsert_product($1::jsonb, $2) as r', [JSON.stringify(p), original]);

  test('creates, edits, renames and logs stock changes', async () => {
    await upsert(product());
    let row = await one(`select p.stock, pp.amount from public.products p join public.product_prices pp on pp.product_id = p.id
                         where p.slug = 'rose-toner' and pp.currency = 'GHS'`);
    assert.deepEqual(row, { stock: 25, amount: 21000 });

    await upsert(product({ slug: 'rose-toner-2', stock: 20, compareAt: { GBP: 2000, GHS: 26000 } }), 'rose-toner');
    row = await one(`select p.stock, pp.compare_at from public.products p join public.product_prices pp on pp.product_id = p.id
                     where p.slug = 'rose-toner-2' and pp.currency = 'GBP'`);
    assert.deepEqual(row, { stock: 20, compare_at: 2000 });
    const moves = await q(`select delta, reason from public.inventory_movements m join public.products p on p.id = m.product_id
                           where p.slug = 'rose-toner-2' order by m.created_at, m.id`);
    assert.deepEqual(moves, [{ delta: 25, reason: 'initial' }, { delta: -5, reason: 'admin_adjustment' }]);
  });

  test('rejects duplicate slugs, unknown categories and missing products', async () => {
    await assert.rejects(upsert(product({ slug: 'gentle-gel-cleanser' })), (e) => e.code === '23505');
    await rejects(upsert(product({ category: 'nope' })), 'UNKNOWN_CATEGORY');
    await rejects(upsert(product(), 'does-not-exist'), 'PRODUCT_NOT_FOUND');
  });

  test('admin_dashboard reports revenue per currency, to-fulfil and low stock', async () => {
    const o = (await placeOrder({ items: [{ slug: 'gentle-gel-cleanser', qty: 1 }], subtotal: 1400 })).rows[0].r;
    await db.query(`select public.set_order_status($1, 'paid', null, null)`, [o.number]);
    const d = (await one(`select public.admin_dashboard('GBP', 7) as d`)).d;
    assert.equal(d.currency, 'GBP');
    assert.equal(d.series.length, 7);
    assert.ok(d.revenue >= 1795);
    assert.ok(d.toFulfil >= 1);
    assert.ok(d.topProducts.length >= 1);
    assert.ok(d.lowStock.some((p) => p.slug === 'light-gel-moisturiser'));
    const ghs = (await one(`select public.admin_dashboard('GHS', 30) as d`)).d;
    assert.equal(ghs.currency, 'GHS');
    assert.ok(ghs.revenue < d.revenue * 1000); // currencies are reported separately, never summed
  });

  test('admin_order_counts tallies orders by status', async () => {
    const c = (await one('select public.admin_order_counts() as c')).c;
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    assert.equal(total, (await one('select count(*)::int n from public.orders')).n);
    assert.ok(c.pending_payment >= 1);
  });

  test('admin_customers groups orders by email with per-currency spend', async () => {
    const c = (await one('select public.admin_customers() as c')).c;
    const ada = c.find((x) => x.email === 'ada@example.com');
    assert.ok(ada);
    assert.equal(ada.name, 'Ada Lovelace');
    assert.ok(ada.orders >= 2);
    assert.ok(ada.spent.GBP > 0);
  });
});

describe('security (RLS and privileges)', () => {
  test('anonymous visitors see only active products and their prices', async () => {
    await db.exec(`update public.products set status = 'draft' where slug = 'clay-purifying-mask'`);
    const slugs = await as('anon', null, async () => (await q('select slug from public.products')).map((r) => r.slug));
    assert.ok(!slugs.includes('clay-purifying-mask'));
    assert.ok(slugs.includes('gentle-gel-cleanser'));
    const prices = await as('anon', null, () => q(`select p.slug from public.product_prices pp join public.products p on p.id = pp.product_id
                                                    where p.slug = 'clay-purifying-mask'`));
    assert.equal(prices.length, 0);
    await db.exec(`update public.products set status = 'active' where slug = 'clay-purifying-mask'`);
  });

  test('anonymous visitors cannot read orders, payments, stock history or profiles', async () => {
    for (const t of ['orders', 'order_items', 'order_events', 'payments', 'inventory_movements', 'profiles']) {
      await as('anon', null, () => assert.rejects(q(`select * from public.${t}`), /permission denied/));
    }
  });

  test('anonymous visitors cannot write the catalogue', async () => {
    await as('anon', null, () => assert.rejects(q(`update public.products set stock = 999`), /permission denied/));
    await as('anon', null, () => assert.rejects(q(`delete from public.product_prices`), /permission denied/));
  });

  test('customers see only their own orders; admins see all', async () => {
    await db.exec(`update public.orders set user_id = '${ALICE}' where id = (select id from public.orders order by created_at limit 1)`);
    await db.exec(`update public.orders set user_id = '${BOB}' where id = (select id from public.orders order by created_at desc limit 1)`);
    const alice = await as('authenticated', ALICE, () => q('select user_id from public.orders'));
    assert.ok(alice.length >= 1 && alice.every((r) => r.user_id === ALICE));
    const items = await as('authenticated', ALICE, () => q('select order_id from public.order_items'));
    assert.ok(items.length >= 1);
    const all = await as('authenticated', ADMIN, () => q('select id from public.orders'));
    assert.ok(all.length > alice.length);
  });

  test('customers cannot write orders, escalate their role or read payments', async () => {
    await as('authenticated', ALICE, async () => {
      await assert.rejects(q(`update public.orders set status = 'paid'`), /permission denied/);
      await assert.rejects(q(`update public.profiles set role = 'admin' where id = '${ALICE}'`), /permission denied/);
      await assert.rejects(q(`insert into public.profiles (id, email) values (gen_random_uuid(), 'x@y.z')`), /permission denied/);
      assert.equal((await q('select * from public.payments')).length, 0);
    });
  });

  test('customers can update their own display name only', async () => {
    await as('authenticated', ALICE, () => q(`update public.profiles set full_name = 'Alice A' where id = '${ALICE}'`));
    assert.equal((await one(`select full_name from public.profiles where id = '${ALICE}'`)).full_name, 'Alice A');
    await as('authenticated', ALICE, () => q(`update public.profiles set full_name = 'Hacked' where id = '${BOB}'`));
    assert.notEqual((await one(`select full_name from public.profiles where id = '${BOB}'`)).full_name, 'Hacked');
  });

  test('only admins can write the catalogue as a signed-in user', async () => {
    await as('authenticated', ALICE, async () => {
      assert.equal((await db.query(`update public.products set tagline = 'x' returning id`)).rows.length, 0);
    });
    await as('authenticated', ADMIN, async () => {
      assert.ok((await db.query(`update public.products set tagline = tagline where slug = 'gentle-gel-cleanser' returning id`)).rows.length === 1);
    });
  });

  test('business functions cannot be called by anon or signed-in users, only the service role', async () => {
    const calls = [
      `select public.release_expired_orders()`,
      `select public.admin_customers()`,
      `select public.admin_order_counts()`,
      `select public.admin_dashboard('GBP', 7)`,
      `select public.set_order_status('SM-1001', 'paid', null, null)`,
      `select public.mark_order_paid('SM-1001', 'manual', 'x', 1, 'GBP', null)`,
      `select public.admin_upsert_product('{}'::jsonb, null)`,
    ];
    for (const role of ['anon', 'authenticated']) {
      for (const c of calls) await as(role, ALICE, () => assert.rejects(q(c), /permission denied for function/));
    }
    const n = await as('service_role', null, async () => (await one('select public.release_expired_orders() as n')).n);
    assert.equal(typeof n, 'number');
  });
});


/* ======================= discounts, newsletter, reviews ======================= */

let codeSeq = 0;
async function mkCode(over = {}) {
  const c = { code: `TEST${++codeSeq}`, kind: 'percent', percent: 10, amount_gbp: null, amount_ghs: null, min_gbp: 0, min_ghs: 0, max_uses: null, first_order_only: false, one_per_email: true, restricted_email: null, starts_at: null, ends_at: null, active: true, ...over };
  await db.query(
    `insert into public.discount_codes (code, kind, percent, amount_gbp, amount_ghs, min_subtotal_gbp, min_subtotal_ghs, max_uses, first_order_only, one_per_email, restricted_email, starts_at, ends_at, active)
     values ($1, $2::public.discount_kind, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [c.code, c.kind, c.percent, c.amount_gbp, c.amount_ghs, c.min_gbp, c.min_ghs, c.max_uses, c.first_order_only, c.one_per_email, c.restricted_email, c.starts_at, c.ends_at, c.active],
  );
  return c.code;
}
const SUNSCREEN = [{ slug: 'daily-sunscreen-spf-50', qty: 1 }]; // 1600 GBP / 21000 GHS
const codeRow = async (code) => one('select uses from public.discount_codes where code = $1', [code]);
let emailSeq = 0;
const freshEmail = () => `buyer${++emailSeq}@example.com`;

describe('discount codes', () => {
  test('a percentage code reduces the total and records a redemption', async () => {
    const code = await mkCode({ percent: 10 });
    const email = freshEmail();
    const r = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email, discountCode: code })).rows[0].r;
    assert.equal(r.discount, 160);
    assert.equal(r.total, 1600 - 160 + 395);
    assert.equal((await codeRow(code)).uses, 1);
    const o = await one('select discount, discount_code, total from public.orders where number = $1', [r.number]);
    assert.deepEqual(o, { discount: 160, discount_code: code, total: 1835 });
    assert.equal((await one('select count(*)::int n from public.discount_redemptions where order_id = $1', [r.id])).n, 1);
  });

  test('codes are case-insensitive and ignore stray spaces', async () => {
    const code = await mkCode({ percent: 5 });
    const r = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: `  ${code.toLowerCase()} ` })).rows[0].r;
    assert.equal(r.discount, 80);
  });

  test('a fixed code uses the amount for the order currency and never exceeds the products total', async () => {
    const code = await mkCode({ kind: 'fixed', percent: null, amount_gbp: 500, amount_ghs: 6000 });
    const uk = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code })).rows[0].r;
    assert.equal(uk.discount, 500);
    const big = await mkCode({ kind: 'fixed', percent: null, amount_gbp: 9999, amount_ghs: 99999 });
    const capped = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: big })).rows[0].r;
    assert.equal(capped.discount, 1600);
    assert.equal(capped.total, 395); // only delivery left to pay
    const gh = (await db.query(
      `select public.create_order(null, $1, 'GH', '{"firstName":"K"}'::jsonb, 'gh-regional', 'Regional', '2-5 days', 6000, '{"method":"card"}'::jsonb, $2::jsonb, 21000, 30, $3, null) as r`,
      [freshEmail(), JSON.stringify(SUNSCREEN), code])).rows[0].r;
    assert.equal(gh.discount, 6000);
    assert.equal(gh.total, 21000 - 6000 + 6000);
  });

  test('rejects unknown, inactive, expired and not-yet-started codes with a clear reason', async () => {
    const inactive = await mkCode({ active: false });
    const expired = await mkCode({ ends_at: '2020-01-01T00:00:00Z' });
    const future = await mkCode({ starts_at: '2099-01-01T00:00:00Z' });
    for (const [code, reason] of [['NOPE', 'NOT_FOUND'], [inactive, 'INACTIVE'], [expired, 'EXPIRED'], [future, 'NOT_STARTED']]) {
      await rejects(placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code }), 'DISCOUNT_INVALID', reason);
    }
  });

  test('enforces the minimum spend per currency', async () => {
    const code = await mkCode({ min_gbp: 5000, min_ghs: 60000 });
    await rejects(placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code }), 'DISCOUNT_INVALID', 'MIN_SUBTOTAL');
    const v = (await one(`select public.validate_discount($1, 'a@b.co', 'UK', 1600) as v`, [code])).v;
    assert.deepEqual([v.valid, v.reason, v.min], [false, 'MIN_SUBTOTAL', 5000]);
  });

  test('max_uses is enforced and a failed order does not use up a redemption', async () => {
    const code = await mkCode({ max_uses: 1 });
    await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code });
    await rejects(placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code }), 'DISCOUNT_INVALID', 'USED_UP');
    const code2 = await mkCode({ max_uses: 1 });
    await rejects(placeOrder({ items: [{ slug: 'clay-purifying-mask', qty: 1 }], subtotal: 1700, email: freshEmail(), discountCode: code2 }), 'OUT_OF_STOCK');
    assert.equal((await codeRow(code2)).uses, 0);
  });

  test('one use per email', async () => {
    const code = await mkCode();
    const email = freshEmail();
    await placeOrder({ items: SUNSCREEN, subtotal: 1600, email, discountCode: code });
    await rejects(placeOrder({ items: SUNSCREEN, subtotal: 1600, email, discountCode: code }), 'DISCOUNT_INVALID', 'ALREADY_USED');
    await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code }); // someone else is fine
  });

  test('first-order-only codes need a customer who has never ordered', async () => {
    const code = await mkCode({ first_order_only: true });
    const returning = freshEmail();
    await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: returning });
    await rejects(placeOrder({ items: SUNSCREEN, subtotal: 1600, email: returning, discountCode: code }), 'DISCOUNT_INVALID', 'FIRST_ORDER_ONLY');
    const r = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code })).rows[0].r;
    assert.equal(r.discount, 160);
  });

  test('a cancelled earlier order does not count against "first order"', async () => {
    const code = await mkCode({ first_order_only: true });
    const email = freshEmail();
    const first = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email })).rows[0].r;
    await db.query(`select public.set_order_status($1, 'cancelled', null, null)`, [first.number]);
    assert.equal((await placeOrder({ items: SUNSCREEN, subtotal: 1600, email, discountCode: code })).rows[0].r.discount, 160);
  });

  test('a code issued to one email does not work for anyone else and does not reveal itself', async () => {
    const email = freshEmail();
    const code = await mkCode({ restricted_email: email });
    await rejects(placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code }), 'DISCOUNT_INVALID', 'NOT_FOUND');
    assert.equal((await one(`select public.validate_discount($1, '', 'UK', 1600) as v`, [code])).v.reason, 'EMAIL_REQUIRED');
    assert.equal((await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: email.toUpperCase(), discountCode: code })).rows[0].r.discount, 160);
  });

  test('a stale expected discount fails the order (price changed)', async () => {
    const code = await mkCode({ percent: 10 });
    const stock = (await one(`select stock from public.products where slug = 'daily-sunscreen-spf-50'`)).stock;
    await rejects(placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code, expectedDiscount: 999 }), 'PRICE_CHANGED');
    assert.equal((await one(`select stock from public.products where slug = 'daily-sunscreen-spf-50'`)).stock, stock);
    assert.equal((await codeRow(code)).uses, 0);
    await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code, expectedDiscount: 160 });
  });

  test('cancelling an order frees its code use so the customer can try again', async () => {
    const code = await mkCode({ max_uses: 1 });
    const email = freshEmail();
    const r = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email, discountCode: code })).rows[0].r;
    assert.equal((await codeRow(code)).uses, 1);
    await db.query(`select public.set_order_status($1, 'cancelled', null, null)`, [r.number]);
    assert.equal((await codeRow(code)).uses, 0);
    assert.equal((await one('select count(*)::int n from public.discount_redemptions where order_id = $1', [r.id])).n, 0);
    assert.equal((await placeOrder({ items: SUNSCREEN, subtotal: 1600, email, discountCode: code })).rows[0].r.discount, 160);
  });

  test('an expired unpaid order also frees its code use', async () => {
    const code = await mkCode({ max_uses: 1 });
    await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail(), discountCode: code, ttl: -5 });
    assert.equal((await codeRow(code)).uses, 1);
    await db.query('select public.release_expired_orders()');
    assert.equal((await codeRow(code)).uses, 0);
  });

  test('the database refuses totals that do not add up', async () => {
    const o = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email: freshEmail() })).rows[0].r;
    await assert.rejects(db.query('update public.orders set discount = subtotal + 1 where id = $1', [o.id]));
    await assert.rejects(db.query('update public.orders set total = total + 1 where id = $1', [o.id]));
  });

  test('validate_discount reports the amount without touching anything', async () => {
    const code = await mkCode({ percent: 25 });
    const v = (await one(`select public.validate_discount($1, 'x@y.co', 'UK', 2000) as v`, [code])).v;
    assert.deepEqual([v.valid, v.discount, v.code], [true, 500, code]);
    assert.equal((await codeRow(code)).uses, 0);
  });

  test('codes and redemptions are invisible to shoppers', async () => {
    for (const t of ['discount_codes', 'discount_redemptions']) {
      await as('anon', null, () => assert.rejects(q(`select * from public.${t}`), /permission denied/));
      await as('authenticated', ALICE, () => assert.rejects(q(`select * from public.${t}`), /permission denied/));
    }
  });
});

describe('newsletter', () => {
  test('subscribing issues a single-use welcome code that only that email can use', async () => {
    const email = freshEmail();
    const r = (await one('select public.subscribe_email($1, $2) as r', [email.toUpperCase(), 'footer'])).r;
    assert.equal(r.email, email);
    assert.equal(r.isNew, true);
    assert.match(r.code, /^WELCOME-[A-F0-9]{6}$/);
    const ok = (await one(`select public.validate_discount($1, $2, 'UK', 2000) as v`, [r.code, email])).v;
    assert.deepEqual([ok.valid, ok.discount], [true, 200]);
    assert.equal((await one(`select public.validate_discount($1, $2, 'UK', 2000) as v`, [r.code, freshEmail()])).v.reason, 'NOT_FOUND');
  });

  test('subscribing again returns the same code and does not create another', async () => {
    const email = freshEmail();
    const a = (await one('select public.subscribe_email($1) as r', [email])).r;
    const b = (await one('select public.subscribe_email($1) as r', [email])).r;
    assert.equal(b.code, a.code);
    assert.equal(b.isNew, false);
    assert.equal((await one('select count(*)::int n from public.discount_codes where restricted_email = $1', [email])).n, 1);
  });

  test('the welcome code works once, on a first order', async () => {
    const email = freshEmail();
    const { code } = (await one('select public.subscribe_email($1) as r', [email])).r;
    const o = (await placeOrder({ items: SUNSCREEN, subtotal: 1600, email, discountCode: code })).rows[0].r;
    assert.equal(o.discount, 160);
    await rejects(placeOrder({ items: SUNSCREEN, subtotal: 1600, email, discountCode: code }), 'DISCOUNT_INVALID');
  });

  test('rejects things that are not emails', async () => {
    for (const bad of ['', 'nope', 'a@b', '@x.co', 'a b@c.co']) await rejects(one('select public.subscribe_email($1)', [bad]), 'INVALID_EMAIL');
  });

  test('unsubscribe works by token, is idempotent, and resubscribing keeps the same code', async () => {
    const email = freshEmail();
    const a = (await one('select public.subscribe_email($1) as r', [email])).r;
    assert.equal((await one('select public.unsubscribe_email($1::uuid) as ok', [a.token])).ok, true);
    assert.equal((await one('select public.unsubscribe_email($1::uuid) as ok', [a.token])).ok, true);
    assert.equal((await one('select public.unsubscribe_email(gen_random_uuid()) as ok')).ok, false);
    assert.notEqual((await one('select unsubscribed_at from public.subscribers where email = $1', [email])).unsubscribed_at, null);
    const again = (await one('select public.subscribe_email($1) as r', [email])).r;
    assert.equal(again.code, a.code);
    assert.equal((await one('select unsubscribed_at from public.subscribers where email = $1', [email])).unsubscribed_at, null);
  });

  test('the subscriber list is private', async () => {
    await as('anon', null, () => assert.rejects(q('select * from public.subscribers'), /permission denied/));
    await as('authenticated', ALICE, () => assert.rejects(q('select * from public.subscribers'), /permission denied/));
  });
});

describe('reviews', () => {
  const CLEANSER = [{ slug: 'gentle-gel-cleanser', qty: 1 }];
  const review = (userId, slug = 'gentle-gel-cleanser', rating = 5, body = 'Gentle and effective, would buy again.') =>
    db.query('select public.submit_review($1, $2, $3, $4, $5, $6) as r', [userId, slug, rating, 'Lovely', body, 'Alice A']);
  const product = () => one(`select rating_value::float as v, rating_count as n from public.products where slug = 'gentle-gel-cleanser'`);
  let aliceReview;

  async function ship(number) {
    for (const s of ['paid', 'processing', 'shipped']) await db.query(`select public.set_order_status($1, $2::public.order_status, null, null)`, [number, s]);
  }

  test('only customers whose order has shipped can review', async () => {
    const o = (await placeOrder({ items: CLEANSER, subtotal: 1400, userId: ALICE, email: 'alice@example.com' })).rows[0].r;
    await rejects(review(ALICE), 'NOT_PURCHASED'); // still unpaid
    await db.query(`select public.set_order_status($1, 'paid', null, null)`, [o.number]);
    await rejects(review(ALICE), 'NOT_PURCHASED'); // paid but not shipped
    await rejects(review(BOB), 'NOT_PURCHASED'); // never bought
    await ship(o.number).catch(() => {});
  });

  test('a verified review starts as pending and is hidden from the public', async () => {
    const o = (await placeOrder({ items: CLEANSER, subtotal: 1400, userId: ALICE, email: 'alice@example.com' })).rows[0].r;
    await ship(o.number);
    aliceReview = (await review(ALICE)).rows[0].r;
    assert.equal(aliceReview.status, 'pending');
    assert.equal((await as('anon', null, () => q('select * from public.reviews'))).length, 0);
    assert.deepEqual(await product(), { v: 0, n: 0 });
  });

  test('approving publishes it and updates the product rating', async () => {
    await db.query(`select public.moderate_review($1, 'approved')`, [aliceReview.id]);
    assert.equal((await as('anon', null, () => q('select * from public.reviews'))).length, 1);
    assert.deepEqual(await product(), { v: 5, n: 1 });
  });

  test('one review per customer per product', async () => {
    await rejects(review(ALICE), 'ALREADY_REVIEWED');
  });

  test('the average is rounded to one decimal and only counts approved reviews', async () => {
    const o = (await placeOrder({ items: CLEANSER, subtotal: 1400, userId: BOB, email: 'bob@example.com' })).rows[0].r;
    await ship(o.number);
    const bob = (await review(BOB, 'gentle-gel-cleanser', 4)).rows[0].r;
    assert.deepEqual(await product(), { v: 5, n: 1 }); // pending does not count
    await db.query(`select public.moderate_review($1, 'approved')`, [bob.id]);
    assert.deepEqual(await product(), { v: 4.5, n: 2 });
    await db.query(`select public.moderate_review($1, 'rejected')`, [bob.id]);
    assert.deepEqual(await product(), { v: 5, n: 1 });
    await db.query('delete from public.reviews where id = $1', [bob.id]);
    assert.deepEqual(await product(), { v: 5, n: 1 });
  });

  test('bad input is rejected by the database', async () => {
    const o = (await placeOrder({ items: [{ slug: 'daily-sunscreen-spf-50', qty: 1 }], subtotal: 1600, userId: ALICE, email: 'alice@example.com' })).rows[0].r;
    await ship(o.number);
    await assert.rejects(review(ALICE, 'daily-sunscreen-spf-50', 6));
    await assert.rejects(review(ALICE, 'daily-sunscreen-spf-50', 0));
    await assert.rejects(review(ALICE, 'daily-sunscreen-spf-50', 5, 'short'));
    await rejects(review(ALICE, 'no-such-product'), 'PRODUCT_NOT_FOUND');
  });

  test('customers see their own pending reviews, admins see everything, others see only approved', async () => {
    const o = (await placeOrder({ items: [{ slug: 'daily-sunscreen-spf-50', qty: 1 }], subtotal: 1600, userId: BOB, email: 'bob@example.com' })).rows[0].r;
    await ship(o.number);
    await review(BOB, 'daily-sunscreen-spf-50', 3, 'It was okay, nothing special for me.'); // pending
    const bobSees = await as('authenticated', BOB, () => q('select user_id, status from public.reviews'));
    assert.ok(bobSees.some((r) => r.user_id === BOB && r.status === 'pending'));
    assert.ok(bobSees.every((r) => r.status === 'approved' || r.user_id === BOB));
    const adminSees = await as('authenticated', ADMIN, () => q('select status from public.reviews'));
    assert.ok(adminSees.some((r) => r.status === 'pending'));
    const anonSees = await as('anon', null, () => q('select status from public.reviews'));
    assert.ok(anonSees.every((r) => r.status === 'approved'));
  });

  test('nobody can write reviews directly; moderation is service-only', async () => {
    await as('authenticated', ALICE, () => assert.rejects(q(`update public.reviews set status = 'approved'`), /permission denied/));
    await as('authenticated', ALICE, () => assert.rejects(q(`insert into public.reviews (product_id, user_id, rating, body, display_name) select id, '${ALICE}', 5, 'a long enough review text', 'x' from public.products limit 1`), /permission denied/));
    await as('authenticated', ALICE, () => assert.rejects(q(`select public.moderate_review(gen_random_uuid(), 'approved')`), /permission denied for function/));
    await rejects(one(`select public.moderate_review(gen_random_uuid(), 'approved')`), 'REVIEW_NOT_FOUND');
  });

  test('the new business functions cannot be called by shoppers', async () => {
    const calls = [
      `select public.validate_discount('X', 'a@b.co', 'UK', 100)`,
      `select public.subscribe_email('a@b.co')`,
      `select public.unsubscribe_email(gen_random_uuid())`,
      `select public.submit_review('${ALICE}', 'x', 5, 't', 'long enough body text', 'n')`,
    ];
    for (const role of ['anon', 'authenticated']) for (const c of calls) await as(role, ALICE, () => assert.rejects(q(c), /permission denied for function/));
  });
});
