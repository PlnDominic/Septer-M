import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { fakeSupabase, type FakeConfig } from './fake-supabase.testing';
import { SupabaseService } from './supabase/supabase.service';

const CRON_SECRET = 'cron-secret-for-tests-1234';
const USERS = {
  'customer-token': { id: 'cust-1', email: 'c@example.com' },
  'admin-token': { id: 'admin-1', email: 'admin@example.com' },
};
const TOKEN = '3f0b1c0e-5b61-4a52-9c52-6d3a5f3c1a10';

const serumRow = {
  slug: 'vitamin-c-brightening-serum',
  name: 'Vitamin C Brightening Serum',
  tagline: 'Brighter',
  status: 'active',
  size_ml: 30,
  skin_types: ['Dull'],
  concerns: ['Dark spots'],
  ingredients: 'Aqua',
  how_to_use: 'Morning',
  image_path: '/images/products/vitamin-c-brightening-serum.jpg',
  is_new: true,
  best_seller: true,
  stock: 18,
  rating_value: 4.7,
  rating_count: 94,
  category: { slug: 'serum' },
  prices: [
    { currency: 'GBP', amount: 2800, compare_at: null },
    { currency: 'GHS', amount: 36000, compare_at: null },
  ],
};

const ukOrder = {
  items: [{ slug: 'vitamin-c-brightening-serum', qty: 1 }],
  checkout: {
    region: 'UK',
    email: 'ada@example.com',
    address: { firstName: 'Ada', lastName: 'Lovelace', line1: '1 High St', city: 'London', postcode: 'SW1A 1AA' },
    shippingId: 'uk-standard',
    payment: { method: 'card' },
  },
};

describe('API (HTTP)', () => {
  let app: NestFastifyApplication;
  let calls: ReturnType<typeof fakeSupabase>['calls'];

  async function boot(config: FakeConfig = {}) {
    const fake = fakeSupabase({ users: USERS, ...config });
    calls = fake.calls;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue(fake.service)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }

  const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
    app.inject({
      method,
      url,
      payload: opts.body as object | undefined,
      headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...opts.headers },
    });

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests-only';
    process.env.CRON_SECRET = CRON_SECRET;
  });
  afterEach(async () => app?.close());

  describe('public catalogue', () => {
    it('GET /v1/health works with no database', async () => {
      await boot();
      const res = await call('GET', '/v1/health');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: 'ok' });
    });

    it('lists products in the storefront shape without internal fields', async () => {
      await boot({ tables: { products: { data: [serumRow] } } });
      const res = await call('GET', '/v1/products?collection=new');
      expect(res.statusCode).toBe(200);
      const [p] = res.json();
      expect(p).toMatchObject({ slug: 'vitamin-c-brightening-serum', category: 'serum', price: { GBP: 2800, GHS: 36000 }, inStock: true });
      expect(p).not.toHaveProperty('stock');
    });

    it('returns 404 for an unknown product and 400 for a bad filter', async () => {
      await boot({ tables: { products: { data: null } } });
      expect((await call('GET', '/v1/products/nope')).statusCode).toBe(404);
      expect((await call('GET', '/v1/products?collection=weird')).statusCode).toBe(400);
    });
  });

  describe('POST /v1/orders', () => {
    const priced = { products: { data: [serumRow] } };

    it('validates the body and explains what is wrong', async () => {
      await boot({ tables: priced });
      const res = await call('POST', '/v1/orders', { body: { items: [], checkout: { region: 'UK' } } });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(res.json().issues.length).toBeGreaterThan(0);
      expect(calls.rpc).toHaveLength(0);
    });

    it('rejects an invalid UK postcode', async () => {
      await boot({ tables: priced });
      const body = { ...ukOrder, checkout: { ...ukOrder.checkout, address: { ...ukOrder.checkout.address, postcode: 'NOPE' } } };
      const res = await call('POST', '/v1/orders', { body });
      expect(res.statusCode).toBe(400);
      expect(res.json().issues.some((i: { path: string }) => i.path.includes('postcode'))).toBe(true);
    });

    it('prices on the server and reserves stock through create_order, ignoring any client-sent price', async () => {
      await boot({
        tables: priced,
        rpc: { create_order: { data: { number: 'SM-1001', token: TOKEN, subtotal: 2800, shipping_cost: 395, total: 3195, currency: 'GBP', expires_at: '2026-11-25T12:00:00Z' } } },
      });
      const res = await call('POST', '/v1/orders', { body: { ...ukOrder, items: [{ ...ukOrder.items[0], unitPrice: 1 }], total: 1 } });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ number: 'SM-1001', token: TOKEN, total: 3195, currency: 'GBP' });

      const [name, args] = calls.rpc[0];
      expect(name).toBe('create_order');
      expect(args).toMatchObject({
        p_user_id: null,
        p_email: 'ada@example.com',
        p_region: 'UK',
        p_shipping_method_id: 'uk-standard',
        p_shipping_cost: 395,
        p_expected_subtotal: 2800,
        p_items: [{ slug: 'vitamin-c-brightening-serum', qty: 1 }],
      });
    });

    it('attaches the signed-in user to the order', async () => {
      await boot({ tables: priced, rpc: { create_order: { data: { number: 'SM-1002', token: TOKEN, subtotal: 2800, shipping_cost: 395, total: 3195, currency: 'GBP', expires_at: null } } } });
      await call('POST', '/v1/orders', { body: ukOrder, token: 'customer-token' });
      expect(calls.rpc[0][1]).toMatchObject({ p_user_id: 'cust-1' });
    });

    it('rejects a bad token rather than treating it as a guest', async () => {
      await boot({ tables: priced });
      expect((await call('POST', '/v1/orders', { body: ukOrder, token: 'garbage' })).statusCode).toBe(401);
    });

    it.each([
      ['OUT_OF_STOCK', 409],
      ['PRICE_CHANGED', 409],
      ['PRODUCT_UNAVAILABLE', 422],
    ])('maps database error %s to HTTP %i', async (message, status) => {
      await boot({ tables: priced, rpc: { create_order: { error: { message, details: 'vitamin-c-brightening-serum', code: 'P0001' } } } });
      const res = await call('POST', '/v1/orders', { body: ukOrder });
      expect(res.statusCode).toBe(status);
      expect(res.json()).toMatchObject({ code: message });
    });

    it('rejects a product that is not in the catalogue before touching stock', async () => {
      await boot({ tables: { products: { data: [] } } });
      const res = await call('POST', '/v1/orders', { body: ukOrder });
      expect(res.statusCode).toBe(422);
      expect(calls.rpc).toHaveLength(0);
    });
  });

  describe('order lookup', () => {
    const order = {
      number: 'SM-1001', public_token: TOKEN, user_id: 'cust-1', email: 'ada@example.com', region: 'UK', currency: 'GBP', status: 'pending_payment',
      shipping_address: { firstName: 'Ada' }, shipping_method_id: 'uk-standard', shipping_label: 'Standard', shipping_detail: '2-4 days', shipping_cost: 395,
      subtotal: 2800, total: 3195, payment: { method: 'card' }, expires_at: null, created_at: '2026-11-25T10:00:00Z',
      items: [{ slug: 's', name: 'Serum', qty: 1, unit_price: 2800 }], events: [{ status: 'pending_payment', note: 'Order placed', created_at: '2026-11-25T10:00:00Z' }],
    };

    it('requires a valid token and never returns it', async () => {
      await boot({ tables: { orders: { data: order } } });
      expect((await call('GET', '/v1/orders/SM-1001')).statusCode).toBe(400);
      expect((await call('GET', '/v1/orders/SM-1001?token=not-a-uuid')).statusCode).toBe(400);
      const res = await call('GET', `/v1/orders/SM-1001?token=${TOKEN}`);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ number: 'SM-1001', total: 3195, lines: [{ name: 'Serum', unitPrice: 2800 }] });
      expect(res.body).not.toContain('public_token');
      expect(res.body).not.toContain('user_id');
      expect(res.body).not.toContain(TOKEN);
    });

    it('returns 404 when the number/token pair does not match', async () => {
      await boot({ tables: { orders: { data: null } } });
      expect((await call('GET', `/v1/orders/SM-1001?token=${TOKEN}`)).statusCode).toBe(404);
    });

    it('lists only a signed-in customer\'s own orders', async () => {
      await boot({ tables: { orders: { data: [order] } } });
      expect((await call('GET', '/v1/me/orders')).statusCode).toBe(401);
      const res = await call('GET', '/v1/me/orders', { token: 'customer-token' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });
  });

  describe('admin routes', () => {
    it.each([
      ['GET', '/v1/admin/orders'],
      ['GET', '/v1/admin/dashboard'],
      ['GET', '/v1/admin/customers'],
      ['GET', '/v1/admin/products'],
      ['POST', '/v1/admin/orders/SM-1/status'],
      ['DELETE', '/v1/admin/products/serum'],
    ] as const)('%s %s: 401 without a token, 403 for customers', async (method, url) => {
      await boot({ role: 'customer' });
      expect((await call(method, url)).statusCode).toBe(401);
      expect((await call(method, url, { token: 'customer-token' })).statusCode).toBe(403);
      expect(calls.rpc).toHaveLength(0);
    });

    it('lets admins read the dashboard and customers', async () => {
      await boot({ role: 'admin', rpc: { admin_dashboard: { data: { revenue: 100 } }, admin_customers: { data: [] } } });
      const d = await call('GET', '/v1/admin/dashboard?currency=GHS&days=7', { token: 'admin-token' });
      expect(d.statusCode).toBe(200);
      expect(calls.rpc[0]).toEqual(['admin_dashboard', { p_currency: 'GHS', p_days: 7 }]);
      expect((await call('GET', '/v1/admin/dashboard?currency=USD', { token: 'admin-token' })).statusCode).toBe(400);
      expect((await call('GET', '/v1/admin/customers', { token: 'admin-token' })).statusCode).toBe(200);
    });

    it('changes order status as the signed-in admin and validates the status', async () => {
      await boot({ role: 'admin', rpc: { set_order_status: { data: { number: 'SM-1', status: 'shipped' } } } });
      expect((await call('POST', '/v1/admin/orders/SM-1/status', { token: 'admin-token', body: { status: 'teleported' } })).statusCode).toBe(400);
      const res = await call('POST', '/v1/admin/orders/SM-1/status', { token: 'admin-token', body: { status: 'shipped', note: 'TRK123' } });
      expect(res.statusCode).toBe(201);
      expect(calls.rpc[0]).toEqual(['set_order_status', { p_order_number: 'SM-1', p_status: 'shipped', p_note: 'TRK123', p_actor: 'admin-1' }]);
    });

    it('surfaces an invalid status transition as 409', async () => {
      await boot({ role: 'admin', rpc: { set_order_status: { error: { message: 'INVALID_TRANSITION', details: 'delivered -> paid', code: 'P0001' } } } });
      const res = await call('POST', '/v1/admin/orders/SM-1/status', { token: 'admin-token', body: { status: 'paid' } });
      expect(res.statusCode).toBe(409);
    });

    it('validates product input and saves through admin_upsert_product', async () => {
      await boot({ role: 'admin', rpc: { admin_upsert_product: { data: { slug: 'rose-toner' } } }, tables: { products: { data: { ...serumRow, slug: 'rose-toner' } } } });
      const bad = await call('POST', '/v1/admin/products', { token: 'admin-token', body: { slug: 'Bad Slug', name: '', category: 'serum', price: { GBP: 1, GHS: 1 }, sizeMl: 1, status: 'active', stock: 1 } });
      expect(bad.statusCode).toBe(400);

      const good = { slug: 'rose-toner', name: 'Rose Toner', category: 'serum', sizeMl: 100, price: { GBP: 1600, GHS: 21000 }, status: 'active', stock: 25 };
      const res = await call('POST', '/v1/admin/products', { token: 'admin-token', body: good });
      expect(res.statusCode).toBe(201);
      expect(calls.rpc[0][0]).toBe('admin_upsert_product');
      expect(calls.rpc[0][1]).toMatchObject({ p_original_slug: null, p_product: { slug: 'rose-toner', isNew: false, skinTypes: [] } });
      expect((await call('PUT', '/v1/admin/products/rose-toner', { token: 'admin-token', body: good })).statusCode).toBe(200);
      expect(calls.rpc[1][1]).toMatchObject({ p_original_slug: 'rose-toner' });
    });

    it('rejects a "was" price that is not higher than the price', async () => {
      await boot({ role: 'admin' });
      const body = { slug: 'x', name: 'X', category: 'serum', sizeMl: 1, price: { GBP: 1600, GHS: 21000 }, compareAt: { GBP: 1000, GHS: 30000 }, status: 'active', stock: 1 };
      expect((await call('POST', '/v1/admin/products', { token: 'admin-token', body })).statusCode).toBe(400);
    });

    it('neutralises search characters that could break the order filter', async () => {
      await boot({ role: 'admin', tables: { orders: { data: [], count: 0 } } });
      const res = await call('GET', '/v1/admin/orders?q=a),status.eq.paid,(b', { token: 'admin-token' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ total: 0, orders: [] });
    });
  });

  describe('scheduled jobs', () => {
    it('rejects calls without the cron secret', async () => {
      await boot({ rpc: { release_expired_orders: { data: 3 } } });
      expect((await call('GET', '/v1/internal/release-expired')).statusCode).toBe(401);
      expect((await call('GET', '/v1/internal/release-expired', { headers: { authorization: 'Bearer wrong' } })).statusCode).toBe(401);
      expect(calls.rpc).toHaveLength(0);
    });

    it('releases expired orders with the right secret', async () => {
      await boot({ rpc: { release_expired_orders: { data: 3 } } });
      const res = await call('GET', '/v1/internal/release-expired', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ released: 3 });
    });
  });
});
