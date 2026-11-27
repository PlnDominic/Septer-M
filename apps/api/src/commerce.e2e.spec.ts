import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { HttpService } from './common/http.service';
import { resetEnvCache } from './config/env';
import { fakeHttp, type Handler } from './fake-http.testing';
import { fakeSupabase, type FakeConfig } from './fake-supabase.testing';
import { signPaystack, signStripe } from './payments/signatures';
import { SupabaseService } from './supabase/supabase.service';

const KEYS = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-for-tests-only',
  WEB_URL: 'https://shop.test',
  STRIPE_SECRET_KEY: 'sk_test_stripe_key',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  PAYSTACK_SECRET_KEY: 'sk_test_paystack_key',
  RESEND_API_KEY: 're_test_key_123',
  EMAIL_FROM: 'Septer-M <orders@shop.test>',
} as const;

const USERS = { 'cust-token': { id: 'cust-1', email: 'c@example.com' }, 'admin-token': { id: 'admin-1', email: 'admin@example.com' } };
const TOKEN = '3f0b1c0e-5b61-4a52-9c52-6d3a5f3c1a10';

const serum = { slug: 'vitamin-c-brightening-serum', name: 'Vitamin C Brightening Serum', status: 'active', prices: [{ currency: 'GBP', amount: 2800 }, { currency: 'GHS', amount: 36000 }] };

const ukBody = (extra: Record<string, unknown> = {}) => ({
  items: [{ slug: serum.slug, qty: 1 }],
  checkout: {
    region: 'UK', email: 'Ada@Example.com',
    address: { firstName: 'Ada', lastName: 'Lovelace', line1: '1 High St', city: 'London', postcode: 'SW1A 1AA' },
    shippingId: 'uk-standard', payment: { method: 'card' },
  },
  ...extra,
});
const ghBody = (payment: Record<string, unknown>) => ({
  items: [{ slug: serum.slug, qty: 1 }],
  checkout: {
    region: 'GH', email: 'kofi@example.com',
    address: { firstName: 'Kofi', lastName: 'Mensah', phone: '024 123 4567', region: 'Greater Accra', city: 'Accra', area: 'East Legon' },
    shippingId: 'gh-accra', payment,
  },
});

const created = (over: Record<string, unknown> = {}) => ({ data: { number: 'SM-1001', token: TOKEN, subtotal: 2800, discount: 0, shipping_cost: 395, total: 3195, currency: 'GBP', expires_at: '2026-12-01T12:00:00Z', ...over } });

const pendingOrder = (over: Record<string, unknown> = {}) => ({
  number: 'SM-1001', public_token: TOKEN, status: 'pending_payment', email: 'ada@example.com', region: 'UK', currency: 'GBP', total: 3195,
  expires_at: new Date(Date.now() + 20 * 60_000).toISOString(), payment: { method: 'card' }, ...over,
});

const emailRow = {
  number: 'SM-1001', public_token: TOKEN, email: 'ada@example.com', currency: 'GBP', subtotal: 2800, discount: 0, discount_code: null,
  shipping_label: 'Standard delivery', shipping_cost: 395, total: 3195, shipping_address: { firstName: 'Ada', lastName: 'Lovelace', line1: '1 High St', city: 'London', postcode: 'SW1A 1AA' },
  items: [{ name: 'Vitamin C Brightening Serum', qty: 1, unit_price: 2800 }],
};

const flush = () => new Promise((r) => setTimeout(r, 25));
const okStripe: Handler = (c) => (c.url.includes('stripe.com') ? { body: { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } } : { body: { id: 'em_1' } });

describe('Commerce API (HTTP)', () => {
  let app: NestFastifyApplication;
  let calls: ReturnType<typeof fakeSupabase>['calls'];
  let http: ReturnType<typeof fakeHttp>;

  async function boot(config: FakeConfig = {}, handler: Handler = okStripe, env: Partial<Record<keyof typeof KEYS, string>> = {}) {
    Object.assign(process.env, KEYS, env);
    for (const k of Object.keys(KEYS) as (keyof typeof KEYS)[]) if (env[k] === '') delete process.env[k];
    resetEnvCache();
    const fake = fakeSupabase({ users: USERS, ...config });
    calls = fake.calls;
    http = fakeHttp(handler);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService).useValue(fake.service)
      .overrideProvider(HttpService).useValue(http.service)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }

  const call = (method: 'GET' | 'POST', url: string, opts: { token?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {}) =>
    app.inject({
      method, url,
      payload: opts.raw ?? (opts.body as object | undefined),
      headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.raw ? { 'content-type': 'application/json' } : {}), ...opts.headers },
    });

  afterEach(async () => app?.close());

  /* ------------------------------------------------------------------ payments */
  describe('starting payment', () => {
    const priced = { products: { data: [serum] } };

    it('UK: creates a Stripe Checkout session for the exact total and returns its URL', async () => {
      await boot({ tables: priced, rpc: { create_order: created() } });
      const res = await call('POST', '/v1/orders', { body: ukBody() });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ number: 'SM-1001', token: TOKEN, total: 3195, payment: { action: 'redirect', provider: 'stripe', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } });

      const [stripe] = http.to('api.stripe.com');
      expect(stripe.headers.Authorization).toBe(`Bearer ${KEYS.STRIPE_SECRET_KEY}`);
      expect(stripe.body).toMatchObject({
        mode: 'payment', client_reference_id: 'SM-1001', customer_email: 'ada@example.com',
        'line_items[0][price_data][currency]': 'gbp', 'line_items[0][price_data][unit_amount]': '3195', 'metadata[order_number]': 'SM-1001',
        cancel_url: 'https://shop.test/checkout?payment=cancelled',
      });
      expect(String(stripe.body.success_url)).toBe(`https://shop.test/checkout/confirmation?order=SM-1001&token=${TOKEN}`);
      expect(Number(stripe.body.expires_at) - Date.now() / 1000).toBeGreaterThan(30 * 60);
    });

    it('charges the total AFTER the discount (what the shopper actually owes)', async () => {
      await boot({ tables: priced, rpc: { validate_discount: { data: { valid: true, code: 'SAVE10', discount: 280 } }, create_order: created({ discount: 280, total: 2915 }) } });
      const res = await call('POST', '/v1/orders', { body: ukBody({ promoCode: 'save10' }) });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ discount: 280, total: 2915 });
      expect(http.to('api.stripe.com')[0].body['line_items[0][price_data][unit_amount]']).toBe('2915');
    });

    it('a payment provider failure still returns the order, with a retryable error', async () => {
      await boot({ tables: priced, rpc: { create_order: created() } }, () => ({ status: 503, body: { error: 'down' } }));
      const res = await call('POST', '/v1/orders', { body: ukBody() });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ number: 'SM-1001', payment: { action: 'error' } });
      expect(res.body).not.toContain('down');
    });

    it('without payment keys the order is still placed and says payments are not set up', async () => {
      await boot({ tables: priced, rpc: { create_order: created() } }, okStripe, { STRIPE_SECRET_KEY: '', PAYSTACK_SECRET_KEY: '' });
      const res = await call('POST', '/v1/orders', { body: ukBody() });
      expect(res.statusCode).toBe(201);
      expect(res.json().payment).toEqual({ action: 'none', reason: 'PAYMENTS_NOT_CONFIGURED' });
      expect(http.calls).toHaveLength(0);
    });

    it('Ghana + Mobile Money: sends a prompt to the phone in the local format, for the right network', async () => {
      const cases: [string, string][] = [['mtn', 'mtn'], ['telecel', 'vod'], ['airteltigo', 'tgo']];
      for (const [network, provider] of cases) {
        await boot({ tables: priced, rpc: { create_order: created({ total: 39500, subtotal: 36000, shipping_cost: 3500, currency: 'GHS' }) } },
          () => ({ body: { status: true, data: { status: 'pay_offline', display_text: 'Approve on your phone', reference: 'SM-1001.abc' } } }));
        const res = await call('POST', '/v1/orders', { body: ghBody({ method: 'momo', network, phone: '+233 24 123 4567' }) });
        expect(res.statusCode).toBe(201);
        expect(res.json().payment).toEqual({ action: 'momo_prompt', network, reference: 'SM-1001.abc', message: 'Approve on your phone' });
        const [charge] = http.to('api.paystack.co');
        expect(charge.url).toBe('https://api.paystack.co/charge');
        expect(charge.body).toMatchObject({ amount: 39500, currency: 'GHS', email: 'kofi@example.com', mobile_money: { phone: '0241234567', provider }, metadata: { order_number: 'SM-1001' } });
        expect(String(charge.body.reference)).toMatch(/^SM-1001\.[a-z0-9]+$/);
        await app.close();
      }
    });

    it('Ghana + card: sends the shopper to Paystack\'s hosted page', async () => {
      await boot({ tables: priced, rpc: { create_order: created({ total: 39500, currency: 'GHS' }) } }, () => ({ body: { status: true, data: { authorization_url: 'https://checkout.paystack.com/abc' } } }));
      const res = await call('POST', '/v1/orders', { body: ghBody({ method: 'card' }) });
      expect(res.json().payment).toEqual({ action: 'redirect', provider: 'paystack', url: 'https://checkout.paystack.com/abc' });
      expect(http.to('api.paystack.co')[0].body).toMatchObject({ amount: 39500, currency: 'GHS', channels: ['card'] });
    });

    it('a network that needs a one-time code asks for it', async () => {
      await boot({ tables: priced, rpc: { create_order: created({ total: 39500, currency: 'GHS' }) } }, () => ({ body: { status: true, data: { status: 'send_otp', display_text: 'Enter the code we texted you', reference: 'SM-1001.abc' } } }));
      const res = await call('POST', '/v1/orders', { body: ghBody({ method: 'momo', network: 'telecel', phone: '0501234567' }) });
      expect(res.json().payment).toMatchObject({ action: 'momo_otp', reference: 'SM-1001.abc', message: 'Enter the code we texted you' });
    });

    it('a declined Mobile Money charge says so', async () => {
      await boot({ tables: priced, rpc: { create_order: created({ total: 39500, currency: 'GHS' }) } }, () => ({ body: { status: true, data: { status: 'failed', reference: 'SM-1001.abc' } } }));
      const res = await call('POST', '/v1/orders', { body: ghBody({ method: 'momo', network: 'mtn', phone: '0241234567' }) });
      expect(res.json().payment).toMatchObject({ action: 'error' });
      expect(res.json().payment.message).toContain('declined');
    });
  });

  /* ------------------------------------------------------------------ promo codes */
  describe('promo codes', () => {
    const priced = { products: { data: [serum] } };

    it('passes the code and the discount the shopper saw to create_order', async () => {
      await boot({ tables: priced, rpc: { validate_discount: { data: { valid: true, code: 'SAVE10', discount: 280 } }, create_order: created({ discount: 280, total: 2915 }) } });
      await call('POST', '/v1/orders', { body: ukBody({ promoCode: ' save10 ' }) });
      expect(calls.rpc[0]).toEqual(['validate_discount', { p_code: 'save10', p_email: 'Ada@Example.com', p_region: 'UK', p_subtotal: 2800 }]);
      expect(calls.rpc[1][1]).toMatchObject({ p_discount_code: 'save10', p_expected_discount: 280, p_expected_subtotal: 2800 });
    });

    it.each([
      ['EXPIRED', 'expired'], ['USED_UP', 'fully used'], ['FIRST_ORDER_ONLY', 'first orders'], ['ALREADY_USED', 'already used'], ['NOT_FOUND', 'isn’t valid'],
    ])('refuses a %s code with a clear message and creates nothing', async (reason, text) => {
      await boot({ tables: priced, rpc: { validate_discount: { data: { valid: false, reason } } } });
      const res = await call('POST', '/v1/orders', { body: ukBody({ promoCode: 'NOPE123' }) });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'PROMO_INVALID', reason });
      expect(res.json().message).toContain(text);
      expect(calls.rpc.map(([n]) => n)).toEqual(['validate_discount']);
    });

    it('a code that becomes invalid at the last moment (race) is also a friendly 422', async () => {
      await boot({ tables: priced, rpc: { validate_discount: { data: { valid: true, code: 'X1X', discount: 100 } }, create_order: { error: { message: 'DISCOUNT_INVALID', details: 'USED_UP', code: 'P0001' } } } });
      const res = await call('POST', '/v1/orders', { body: ukBody({ promoCode: 'X1X' }) });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'PROMO_INVALID', reason: 'USED_UP' });
    });

    it('POST /promo/validate returns the discount for the current bag', async () => {
      await boot({ tables: priced, rpc: { validate_discount: { data: { valid: true, code: 'SAVE10', discount: 280, description: '10% off' } } } });
      const res = await call('POST', '/v1/promo/validate', { body: { code: 'save10', email: 'a@b.co', region: 'UK', items: [{ slug: serum.slug, qty: 1 }] } });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ valid: true, subtotal: 2800, discount: 280, code: 'SAVE10' });
    });

    it('reports why a code cannot be used, including the minimum spend', async () => {
      await boot({ tables: priced, rpc: { validate_discount: { data: { valid: false, reason: 'MIN_SUBTOTAL', min: 5000 } } } });
      const res = await call('POST', '/v1/promo/validate', { body: { code: 'BIG50', region: 'UK', items: [{ slug: serum.slug, qty: 1 }] } });
      expect(res.json()).toMatchObject({ valid: false, reason: 'MIN_SUBTOTAL', min: 5000, discount: 0 });
      expect(calls.rpc[0][1]).toMatchObject({ p_email: '' });
    });

    it('validates input and limits guessing', async () => {
      await boot({ tables: priced, rpc: { validate_discount: { data: { valid: false, reason: 'NOT_FOUND' } } } });
      expect((await call('POST', '/v1/promo/validate', { body: { code: 'x', region: 'UK', items: [] } })).statusCode).toBe(400);
      let last = 0;
      for (let i = 0; i < 32; i++) last = (await call('POST', '/v1/promo/validate', { body: { code: `GUESS${i}`, region: 'UK', items: [{ slug: serum.slug, qty: 1 }] }, headers: { 'x-forwarded-for': '7.7.7.7' } })).statusCode;
      expect(last).toBe(429);
    });
  });

  /* ------------------------------------------------------------------ retry + OTP */
  describe('retrying an unpaid order', () => {
    it('starts a fresh payment for an unpaid order', async () => {
      await boot({ tables: { orders: { data: pendingOrder() } } });
      const res = await call('POST', '/v1/orders/SM-1001/payment', { body: { token: TOKEN } });
      expect(res.statusCode).toBe(201);
      expect(res.json().payment).toMatchObject({ action: 'redirect', provider: 'stripe' });
      expect(http.to('api.stripe.com')[0].body['line_items[0][price_data][unit_amount]']).toBe('3195');
    });

    it.each([
      ['already paid', { status: 'paid' }],
      ['cancelled', { status: 'cancelled' }],
      ['expired', { expires_at: new Date(Date.now() - 60_000).toISOString() }],
    ])('refuses an order that is %s', async (_n, over) => {
      await boot({ tables: { orders: { data: pendingOrder(over) } } });
      const res = await call('POST', '/v1/orders/SM-1001/payment', { body: { token: TOKEN } });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('ORDER_NOT_PAYABLE');
      expect(http.calls).toHaveLength(0);
    });

    it('a wrong token is a 404 and a malformed one a 400', async () => {
      await boot({ tables: { orders: { data: null } } });
      expect((await call('POST', '/v1/orders/SM-1001/payment', { body: { token: TOKEN } })).statusCode).toBe(404);
      expect((await call('POST', '/v1/orders/SM-1001/payment', { body: { token: 'nope' } })).statusCode).toBe(400);
    });

    it('submits a Mobile Money one-time code for the right order only', async () => {
      const momo = pendingOrder({ region: 'GH', currency: 'GHS', total: 39500, payment: { method: 'momo', network: 'telecel', phone: '0501234567' } });
      await boot({ tables: { orders: { data: momo } } }, () => ({ body: { status: true, data: { status: 'pay_offline', display_text: 'Approve now', reference: 'SM-1001.abc' } } }));
      const ok = await call('POST', '/v1/orders/SM-1001/payment/otp', { body: { token: TOKEN, reference: 'SM-1001.abc', otp: '123456' } });
      expect(ok.json().payment).toMatchObject({ action: 'momo_prompt' });
      expect(http.to('api.paystack.co')[0]).toMatchObject({ url: 'https://api.paystack.co/charge/submit_otp', body: { otp: '123456', reference: 'SM-1001.abc' } });

      const other = await call('POST', '/v1/orders/SM-1001/payment/otp', { body: { token: TOKEN, reference: 'SM-9999.abc', otp: '123456' } });
      expect(other.json().payment).toMatchObject({ action: 'error' });
      expect(http.to('api.paystack.co')).toHaveLength(1);
    });

    it('an order not paid by Mobile Money cannot take a code', async () => {
      await boot({ tables: { orders: { data: pendingOrder() } } });
      expect((await call('POST', '/v1/orders/SM-1001/payment/otp', { body: { token: TOKEN, reference: 'SM-1001.abc', otp: '123456' } })).statusCode).toBe(409);
    });
  });

  /* ------------------------------------------------------------------ webhooks */
  describe('Stripe webhook', () => {
    const event = (over: Record<string, unknown> = {}, type = 'checkout.session.completed') =>
      JSON.stringify({ id: 'evt_1', type, data: { object: { id: 'cs_test_1', client_reference_id: 'SM-1001', payment_status: 'paid', amount_total: 3195, currency: 'gbp', ...over } } });
    const send = (raw: string, sig = signStripe(raw, KEYS.STRIPE_WEBHOOK_SECRET)) => call('POST', '/v1/webhooks/stripe', { raw, headers: { 'stripe-signature': sig } });
    const paid = { mark_order_paid: { data: { number: 'SM-1001', status: 'paid' } } };

    it('a genuine payment marks the order paid and emails the customer once', async () => {
      await boot({ rpc: paid, tables: { orders: { data: emailRow } } });
      const res = await send(event());
      expect(res.statusCode).toBe(200);
      expect(calls.rpc[0]).toEqual(['mark_order_paid', { p_order_number: 'SM-1001', p_provider: 'stripe', p_provider_ref: 'cs_test_1', p_amount: 3195, p_currency: 'GBP', p_raw: { provider: 'stripe', ref: 'cs_test_1' } }]);
      await flush();
      const [mail] = http.to('api.resend.com');
      expect(mail.headers.Authorization).toBe(`Bearer ${KEYS.RESEND_API_KEY}`);
      expect(mail.body).toMatchObject({ from: KEYS.EMAIL_FROM, to: ['ada@example.com'], subject: 'Order SM-1001 confirmed' });
      expect(String(mail.body.html)).toContain(`https://shop.test/track?order=SM-1001&amp;token=${TOKEN}`);
    });

    it('async payment success also counts', async () => {
      await boot({ rpc: paid, tables: { orders: { data: emailRow } } });
      expect((await send(event({}, 'checkout.session.async_payment_succeeded'))).statusCode).toBe(200);
      expect(calls.rpc).toHaveLength(1);
    });

    it.each([
      ['a changed body', () => event().replace('3195', '1')],
    ])('rejects %s', async (_n, tamper) => {
      await boot({ rpc: paid });
      const raw = event();
      const res = await send(tamper(), signStripe(raw, KEYS.STRIPE_WEBHOOK_SECRET));
      expect(res.statusCode).toBe(400);
      expect(calls.rpc).toHaveLength(0);
    });

    it('rejects a wrong secret, a stale timestamp, a missing header, and an unconfigured secret', async () => {
      await boot({ rpc: paid });
      const raw = event();
      expect((await send(raw, signStripe(raw, 'whsec_someone_else'))).statusCode).toBe(400);
      expect((await send(raw, signStripe(raw, KEYS.STRIPE_WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600))).statusCode).toBe(400);
      expect((await call('POST', '/v1/webhooks/stripe', { raw })).statusCode).toBe(400);
      await app.close();
      await boot({ rpc: paid }, okStripe, { STRIPE_WEBHOOK_SECRET: '' });
      expect((await send(raw, signStripe(raw, KEYS.STRIPE_WEBHOOK_SECRET))).statusCode).toBe(400);
      expect(calls.rpc).toHaveLength(0);
    });

    it('ignores unpaid sessions and unrelated events (still 200 so Stripe stops retrying)', async () => {
      await boot({ rpc: paid });
      expect((await send(event({ payment_status: 'unpaid' }))).json()).toMatchObject({ received: true, ignored: 'checkout.session.completed' });
      expect((await send(event({}, 'charge.refunded'))).json()).toMatchObject({ ignored: 'charge.refunded' });
      expect(calls.rpc).toHaveLength(0);
    });

    it('ignores events it cannot use (bad order number, non-integer amount, odd currency)', async () => {
      await boot({ rpc: paid });
      for (const over of [{ client_reference_id: 'evil; drop table' }, { amount_total: '3195' }, { amount_total: 31.5 }, { currency: 'usd' }, { client_reference_id: undefined }]) {
        expect((await send(event(over))).json()).toMatchObject({ received: true, ignored: 'unusable' });
      }
      expect(calls.rpc).toHaveLength(0);
    });

    it('a repeated delivery does not email again; a mismatch or late payment is flagged, not emailed', async () => {
      for (const result of [{ status: 'paid', duplicate: true }, { status: 'pending_payment', mismatch: true }, { status: 'cancelled', review: true }]) {
        await boot({ rpc: { mark_order_paid: { data: { number: 'SM-1001', ...result } } }, tables: { orders: { data: emailRow } } });
        expect((await send(event())).statusCode).toBe(200);
        await flush();
        expect(http.to('api.resend.com')).toHaveLength(0);
        await app.close();
      }
    });

    it('acknowledges a payment for an unknown order but asks Stripe to retry real failures', async () => {
      await boot({ rpc: { mark_order_paid: { error: { message: 'ORDER_NOT_FOUND', details: 'SM-1001', code: 'P0001' } } } });
      expect((await send(event())).json()).toMatchObject({ ignored: 'unknown-order' });
      await app.close();
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await boot({ rpc: { mark_order_paid: { error: { message: 'connection reset', code: '08006' } } } });
      expect((await send(event())).statusCode).toBe(500);
      spy.mockRestore();
    });

    it('works without email configured (no email attempt, no error)', async () => {
      await boot({ rpc: paid, tables: { orders: { data: emailRow } } }, okStripe, { RESEND_API_KEY: '' });
      expect((await send(event())).statusCode).toBe(200);
      await flush();
      expect(http.to('api.resend.com')).toHaveLength(0);
    });

    it('a failing email service never breaks the payment', async () => {
      await boot({ rpc: paid, tables: { orders: { data: emailRow } } }, () => ({ status: 500, body: {} }));
      expect((await send(event())).statusCode).toBe(200);
      await flush();
    });
  });

  describe('Paystack webhook', () => {
    const body = (over: Record<string, unknown> = {}, ev = 'charge.success') =>
      JSON.stringify({ event: ev, data: { id: 4401, status: 'success', reference: 'SM-1001.m3k9', amount: 39500, currency: 'GHS', metadata: { order_number: 'SM-1001' }, ...over } });
    const send = (raw: string, sig = signPaystack(raw, KEYS.PAYSTACK_SECRET_KEY)) => call('POST', '/v1/webhooks/paystack', { raw, headers: { 'x-paystack-signature': sig } });
    const paid = { mark_order_paid: { data: { number: 'SM-1001', status: 'paid' } } };

    it('a successful charge marks the order paid', async () => {
      await boot({ rpc: paid, tables: { orders: { data: { ...emailRow, currency: 'GHS' } } } });
      const res = await send(body());
      expect(res.statusCode).toBe(200);
      expect(calls.rpc[0]).toEqual(['mark_order_paid', { p_order_number: 'SM-1001', p_provider: 'paystack', p_provider_ref: '4401', p_amount: 39500, p_currency: 'GHS', p_raw: { provider: 'paystack', ref: '4401' } }]);
      await flush();
      expect(http.to('api.resend.com')).toHaveLength(1);
    });

    it('finds the order from the reference when metadata is missing', async () => {
      await boot({ rpc: paid, tables: { orders: { data: emailRow } } });
      await send(body({ metadata: undefined }));
      expect((calls.rpc[0][1] as { p_order_number: string }).p_order_number).toBe('SM-1001');
    });

    it('rejects bad or missing signatures and tampered bodies', async () => {
      await boot({ rpc: paid });
      const raw = body();
      expect((await send(raw, signPaystack(raw, 'sk_other_key_value'))).statusCode).toBe(400);
      expect((await send(raw.replace('39500', '1'), signPaystack(raw, KEYS.PAYSTACK_SECRET_KEY))).statusCode).toBe(400);
      expect((await call('POST', '/v1/webhooks/paystack', { raw })).statusCode).toBe(400);
      expect(calls.rpc).toHaveLength(0);
    });

    it('ignores failed or other charge events', async () => {
      await boot({ rpc: paid });
      expect((await send(body({ status: 'failed' }))).json()).toMatchObject({ ignored: 'charge.success' });
      expect((await send(body({}, 'charge.dispute.create'))).json()).toMatchObject({ ignored: 'charge.dispute.create' });
      expect(calls.rpc).toHaveLength(0);
    });
  });

  /* ------------------------------------------------------------------ tracking */
  describe('order tracking', () => {
    const row = { ...emailRow, user_id: 'x', status: 'shipped', region: 'UK', shipping_method_id: 'uk-standard', shipping_detail: '2-4 days', payment: { method: 'card' }, expires_at: null, created_at: '2026-11-20T10:00:00Z', items: [{ slug: 's', name: 'Serum', qty: 1, unit_price: 2800 }], events: [{ status: 'shipped', note: 'TRK1', created_at: '2026-11-21T10:00:00Z' }] };

    it('shows an order to someone who knows both its number and its email', async () => {
      await boot({ tables: { orders: { data: row } } });
      const res = await call('POST', '/v1/orders/track', { body: { number: 'sm-1001', email: 'ADA@example.com' } });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ number: 'SM-1001', status: 'shipped', history: [{ status: 'shipped', note: 'TRK1' }] });
      expect(res.body).not.toContain(TOKEN);
    });

    it('a wrong pair looks the same as a missing order', async () => {
      await boot({ tables: { orders: { data: null } } });
      const res = await call('POST', '/v1/orders/track', { body: { number: 'SM-1001', email: 'someone@else.com' } });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('ORDER_NOT_FOUND');
    });

    it('validates input and blocks guessing', async () => {
      await boot({ tables: { orders: { data: null } } });
      expect((await call('POST', '/v1/orders/track', { body: { number: 'hello', email: 'a@b.co' } })).statusCode).toBe(400);
      expect((await call('POST', '/v1/orders/track', { body: { number: 'SM-1001', email: 'nope' } })).statusCode).toBe(400);
      let last = 0;
      for (let i = 0; i < 12; i++) last = (await call('POST', '/v1/orders/track', { body: { number: `SM-${1000 + i}`, email: 'a@b.co' }, headers: { 'x-forwarded-for': '8.8.8.8' } })).statusCode;
      expect(last).toBe(429);
    });
  });

  /* ------------------------------------------------------------------ newsletter */
  describe('newsletter', () => {
    it('a new subscriber gets their welcome code by email', async () => {
      await boot({ rpc: { subscribe_email: { data: { email: 'new@example.com', code: 'WELCOME-AB12CD', isNew: true, token: TOKEN } } } });
      const res = await call('POST', '/v1/subscribe', { body: { email: ' New@Example.com ', source: 'footer' } });
      expect(res.statusCode).toBe(200);
      expect(calls.rpc[0]).toEqual(['subscribe_email', { p_email: 'new@example.com', p_source: 'footer' }]);
      const [mail] = http.to('api.resend.com');
      expect(mail.body).toMatchObject({ to: ['new@example.com'], subject: 'Your 10% welcome code' });
      expect(String(mail.body.html)).toContain('WELCOME-AB12CD');
      expect(String(mail.body.html)).toContain(`https://shop.test/unsubscribe?token=${TOKEN}`);
    });

    it('an existing subscriber gets the same reply and no second email', async () => {
      await boot({ rpc: { subscribe_email: { data: { email: 'old@example.com', code: 'WELCOME-AB12CD', isNew: false, token: TOKEN } } } });
      const res = await call('POST', '/v1/subscribe', { body: { email: 'old@example.com' } });
      expect(res.json().ok).toBe(true);
      expect(http.calls).toHaveLength(0);
    });

    it('rejects bad emails and rate-limits signups', async () => {
      await boot({ rpc: { subscribe_email: { data: { email: 'a@b.co', code: 'C', isNew: false, token: TOKEN } } } });
      expect((await call('POST', '/v1/subscribe', { body: { email: 'nope' } })).statusCode).toBe(400);
      let last = 0;
      for (let i = 0; i < 7; i++) last = (await call('POST', '/v1/subscribe', { body: { email: `p${i}@example.com` }, headers: { 'x-forwarded-for': '6.6.6.6' } })).statusCode;
      expect(last).toBe(429);
    });

    it('unsubscribes by token', async () => {
      await boot({ rpc: { unsubscribe_email: { data: true } } });
      expect((await call('GET', '/v1/unsubscribe?token=bad')).statusCode).toBe(400);
      expect((await call('GET', `/v1/unsubscribe?token=${TOKEN}`)).json()).toEqual({ ok: true });
      expect(calls.rpc[0]).toEqual(['unsubscribe_email', { p_token: TOKEN }]);
    });
  });

  /* ------------------------------------------------------------------ reviews */
  describe('reviews', () => {
    const rows = [
      { rating: 5, title: 'Lovely', body: 'Gentle and effective.', display_name: 'Ada L.', created_at: '2026-11-20T10:00:00Z' },
      { rating: 4, title: '', body: 'Good value for money.', display_name: 'Kofi M.', created_at: '2026-11-19T10:00:00Z' },
      { rating: 5, title: '', body: 'Would buy again, five stars.', display_name: 'Ama O.', created_at: '2026-11-18T10:00:00Z' },
    ];

    it('lists approved reviews with an average and a breakdown, all marked verified', async () => {
      await boot({ tables: { products: { data: { id: 'p1' } }, reviews: { data: rows } } });
      const res = await call('GET', `/v1/products/${serum.slug}/reviews`);
      expect(res.statusCode).toBe(200);
      const j = res.json();
      expect(j.summary).toMatchObject({ average: 4.7, count: 3 });
      expect(j.summary.distribution.find((d: { stars: number }) => d.stars === 5).count).toBe(2);
      expect(j.reviews).toHaveLength(3);
      expect(j.reviews[0]).toEqual({ rating: 5, title: 'Lovely', body: 'Gentle and effective.', name: 'Ada L.', date: '2026-11-20T10:00:00Z', verified: true });
      expect(res.body).not.toContain('user_id');
    });

    it('an unknown product is a 404', async () => {
      await boot({ tables: { products: { data: null } } });
      expect((await call('GET', '/v1/products/nope/reviews')).statusCode).toBe(404);
    });

    it('tells a signed-in customer whether they may review', async () => {
      await boot({ tables: { products: { data: { id: 'p1' } }, order_items: { data: [] }, reviews: { data: [] } } });
      expect((await call('GET', `/v1/products/${serum.slug}/reviews/eligibility`)).statusCode).toBe(401);
      expect((await call('GET', `/v1/products/${serum.slug}/reviews/eligibility`, { token: 'cust-token' })).json()).toEqual({ canReview: false, reason: 'NOT_PURCHASED' });
      await app.close();
      await boot({ tables: { products: { data: { id: 'p1' } }, order_items: { data: [{ id: 'i1' }] }, reviews: { data: [] } } });
      expect((await call('GET', `/v1/products/${serum.slug}/reviews/eligibility`, { token: 'cust-token' })).json()).toEqual({ canReview: true });
      await app.close();
      await boot({ tables: { products: { data: { id: 'p1' } }, order_items: { data: [{ id: 'i1' }] }, reviews: { data: [{ id: 'r1' }] } } });
      expect((await call('GET', `/v1/products/${serum.slug}/reviews/eligibility`, { token: 'cust-token' })).json()).toEqual({ canReview: false, reason: 'ALREADY_REVIEWED' });
    });

    it('submits a review as the signed-in customer', async () => {
      await boot({ rpc: { submit_review: { data: { id: 'r1', status: 'pending' } } } });
      const body = { rating: 5, title: 'Lovely', body: 'Gentle and effective, would buy again.', name: 'Ada L.' };
      expect((await call('POST', `/v1/products/${serum.slug}/reviews`, { body })).statusCode).toBe(401);
      const res = await call('POST', `/v1/products/${serum.slug}/reviews`, { token: 'cust-token', body });
      expect(res.statusCode).toBe(201);
      expect(res.json().status).toBe('pending');
      expect(calls.rpc[0]).toEqual(['submit_review', { p_user_id: 'cust-1', p_slug: serum.slug, p_rating: 5, p_title: 'Lovely', p_body: 'Gentle and effective, would buy again.', p_name: 'Ada L.' }]);
    });

    it('validates reviews and passes on the database rules', async () => {
      await boot({ rpc: { submit_review: { error: { message: 'NOT_PURCHASED', details: serum.slug, code: 'P0001' } } } });
      const good = { rating: 5, body: 'Gentle and effective, would buy again.', name: 'Ada' };
      expect((await call('POST', `/v1/products/${serum.slug}/reviews`, { token: 'cust-token', body: { ...good, rating: 6 } })).statusCode).toBe(400);
      expect((await call('POST', `/v1/products/${serum.slug}/reviews`, { token: 'cust-token', body: { ...good, body: 'short' } })).statusCode).toBe(400);
      const res = await call('POST', `/v1/products/${serum.slug}/reviews`, { token: 'cust-token', body: good });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('NOT_PURCHASED');
    });
  });

  /* ------------------------------------------------------------------ admin */
  describe('admin: promo codes, reviews, shipping emails', () => {
    it('lists, creates and switches promo codes (admins only)', async () => {
      const dbRow = { id: 'd1', code: 'SAVE10', description: '10% off', kind: 'percent', percent: 10, amount_gbp: null, amount_ghs: null, min_subtotal_gbp: 0, min_subtotal_ghs: 0, max_uses: null, uses: 3, first_order_only: false, one_per_email: true, restricted_email: null, starts_at: null, ends_at: null, active: true, created_at: '2026-11-01T00:00:00Z' };
      await boot({ role: 'customer', tables: { discount_codes: { data: [dbRow] } } });
      expect((await call('GET', '/v1/admin/discounts')).statusCode).toBe(401);
      expect((await call('GET', '/v1/admin/discounts', { token: 'cust-token' })).statusCode).toBe(403);
      await app.close();

      await boot({ role: 'admin', tables: { discount_codes: { data: [dbRow] } } });
      const list = await call('GET', '/v1/admin/discounts', { token: 'admin-token' });
      expect(list.json()[0]).toMatchObject({ code: 'SAVE10', percent: 10, uses: 3, onePerEmail: true });
      expect((await call('POST', '/v1/admin/discounts', { token: 'admin-token', body: { code: 'bad code!', kind: 'percent', percent: 10 } })).statusCode).toBe(400);
      expect((await call('POST', '/v1/admin/discounts', { token: 'admin-token', body: { code: 'NEW10', kind: 'percent' } })).statusCode).toBe(400);
      expect((await call('POST', '/v1/admin/discounts', { token: 'admin-token', body: { code: 'FIX5', kind: 'fixed', amountGbp: 500 } })).statusCode).toBe(400);
      expect((await call('POST', '/v1/admin/discounts', { token: 'admin-token', body: { code: 'new10', kind: 'percent', percent: 10 } })).statusCode).toBe(201);
    });

    it('moderates reviews', async () => {
      await boot({ role: 'admin', rpc: { moderate_review: { data: { id: 'r1', status: 'approved' } } }, tables: { reviews: { data: [{ id: 'r1', rating: 5, title: 't', body: 'b'.repeat(12), display_name: 'Ada', status: 'pending', created_at: '2026-11-20T00:00:00Z', product: { slug: serum.slug, name: serum.name } }] } } });
      const list = await call('GET', '/v1/admin/reviews', { token: 'admin-token' });
      expect(list.json()[0]).toMatchObject({ id: 'r1', productSlug: serum.slug, productName: serum.name, status: 'pending' });
      expect((await call('POST', '/v1/admin/reviews/r1/status', { token: 'admin-token', body: { status: 'nonsense' } })).statusCode).toBe(400);
      expect((await call('POST', '/v1/admin/reviews/r1/status', { token: 'admin-token', body: { status: 'approved' } })).statusCode).toBe(201);
      expect(calls.rpc[0]).toEqual(['moderate_review', { p_id: 'r1', p_status: 'approved' }]);
    });

    it('marking an order shipped emails the customer with the note; other statuses do not', async () => {
      await boot({ role: 'admin', rpc: { set_order_status: { data: { number: 'SM-1001', status: 'shipped' } } }, tables: { orders: { data: emailRow } } });
      await call('POST', '/v1/admin/orders/SM-1001/status', { token: 'admin-token', body: { status: 'shipped', note: 'Royal Mail TRK123' } });
      await flush();
      const [mail] = http.to('api.resend.com');
      expect(mail.body).toMatchObject({ to: ['ada@example.com'], subject: 'Order SM-1001 has shipped' });
      expect(String(mail.body.html)).toContain('Royal Mail TRK123');
      await app.close();

      await boot({ role: 'admin', rpc: { set_order_status: { data: { number: 'SM-1001', status: 'processing' } } }, tables: { orders: { data: emailRow } } });
      await call('POST', '/v1/admin/orders/SM-1001/status', { token: 'admin-token', body: { status: 'processing' } });
      await flush();
      expect(http.to('api.resend.com')).toHaveLength(0);
    });
  });

  it('browser preflight allows the verbs the admin uses (PUT, DELETE) with an auth header', async () => {
    await boot();
    for (const method of ['PUT', 'DELETE', 'POST']) {
      const res = await app.inject({ method: 'OPTIONS', url: '/v1/admin/products/x', headers: { origin: 'http://localhost:3000', 'access-control-request-method': method, 'access-control-request-headers': 'authorization,content-type' } });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-methods']).toContain(method);
      expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('authorization');
    }
  });

  /* ------------------------------------------------------------------ catalogue */
  it('the public catalogue shows "only N left" but never the stock count', async () => {
    const row = { slug: 's', name: 'S', tagline: 't', status: 'active', size_ml: 30, skin_types: [], concerns: [], ingredients: '', how_to_use: '', image_path: '/i.jpg', is_new: false, best_seller: false, stock: 3, rating_value: 4.5, rating_count: 2, category: { slug: 'serum' }, prices: [{ currency: 'GBP', amount: 100, compare_at: null }, { currency: 'GHS', amount: 1000, compare_at: null }] };
    await boot({ tables: { products: { data: [row, { ...row, slug: 'big', stock: 80 }, { ...row, slug: 'out', stock: 0 }] } } });
    const list = (await call('GET', '/v1/products')).json();
    expect(list.map((p: { slug: string; inStock: boolean; lowStock: number | null }) => [p.slug, p.inStock, p.lowStock])).toEqual([['s', true, 3], ['big', true, null], ['out', false, null]]);
    expect((await call('GET', '/v1/products')).body).not.toContain('"stock"');
  });
});
