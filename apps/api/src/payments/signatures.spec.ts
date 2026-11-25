import { signPaystack, signStripe, verifyPaystackSignature, verifyStripeSignature } from './signatures';

const SECRET = 'whsec_test_secret_value';
const BODY = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { amount_total: 3195 } } });

describe('verifyStripeSignature', () => {
  it('accepts a correctly signed, recent request', () => {
    expect(verifyStripeSignature(BODY, signStripe(BODY, SECRET), SECRET)).toBe(true);
    expect(verifyStripeSignature(Buffer.from(BODY), signStripe(BODY, SECRET), SECRET)).toBe(true);
  });
  it('rejects a body that was changed after signing', () => {
    expect(verifyStripeSignature(BODY.replace('3195', '1'), signStripe(BODY, SECRET), SECRET)).toBe(false);
  });
  it('rejects the wrong secret', () => {
    expect(verifyStripeSignature(BODY, signStripe(BODY, 'whsec_other'), SECRET)).toBe(false);
  });
  it('rejects old (replayed) requests but allows small clock drift', () => {
    const now = Date.now();
    const old = Math.floor(now / 1000) - 3600;
    expect(verifyStripeSignature(BODY, signStripe(BODY, SECRET, old), SECRET, 300, now)).toBe(false);
    const drift = Math.floor(now / 1000) - 120;
    expect(verifyStripeSignature(BODY, signStripe(BODY, SECRET, drift), SECRET, 300, now)).toBe(true);
  });
  it('accepts any matching v1 when Stripe sends several (key rotation)', () => {
    const good = signStripe(BODY, SECRET);
    const t = good.split(',')[0];
    expect(verifyStripeSignature(BODY, `${t},v1=${'0'.repeat(64)},${good.split(',')[1]}`, SECRET)).toBe(true);
  });
  it('rejects missing, malformed or empty input', () => {
    for (const h of [undefined, '', 'garbage', 't=abc,v1=00', 't=1700000000', 'v1=abcd']) expect(verifyStripeSignature(BODY, h, SECRET)).toBe(false);
    expect(verifyStripeSignature(BODY, signStripe(BODY, SECRET), '')).toBe(false);
  });
  it('does not throw on a signature of the wrong length', () => {
    expect(() => verifyStripeSignature(BODY, `t=${Math.floor(Date.now() / 1000)},v1=abc`, SECRET)).not.toThrow();
  });
});

describe('verifyPaystackSignature', () => {
  const KEY = 'sk_test_paystack_key_value';
  const PBODY = JSON.stringify({ event: 'charge.success', data: { id: 99, reference: 'SM-1001.abc', amount: 24500 } });
  it('accepts the right signature', () => expect(verifyPaystackSignature(PBODY, signPaystack(PBODY, KEY), KEY)).toBe(true));
  it('is case-insensitive about the hex', () => expect(verifyPaystackSignature(PBODY, signPaystack(PBODY, KEY).toUpperCase(), KEY)).toBe(true));
  it('rejects tampering, wrong keys and missing headers', () => {
    expect(verifyPaystackSignature(PBODY.replace('24500', '1'), signPaystack(PBODY, KEY), KEY)).toBe(false);
    expect(verifyPaystackSignature(PBODY, signPaystack(PBODY, 'other-key-value'), KEY)).toBe(false);
    expect(verifyPaystackSignature(PBODY, undefined, KEY)).toBe(false);
    expect(verifyPaystackSignature(PBODY, 'short', KEY)).toBe(false);
    expect(verifyPaystackSignature(PBODY, signPaystack(PBODY, KEY), '')).toBe(false);
  });
});
