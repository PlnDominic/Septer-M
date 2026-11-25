import { RateLimiter, clientIp } from './rate-limiter';

describe('RateLimiter', () => {
  it('allows up to the limit then blocks with 429', () => {
    const l = new RateLimiter();
    for (let i = 0; i < 3; i++) l.check('track', '1.1.1.1', 3, 60_000, 1000);
    expect(() => l.check('track', '1.1.1.1', 3, 60_000, 1000)).toThrow(expect.objectContaining({ status: 429 }));
  });
  it('counts each client and each bucket separately', () => {
    const l = new RateLimiter();
    for (let i = 0; i < 3; i++) l.check('track', 'a', 3, 60_000, 0);
    expect(() => l.check('track', 'b', 3, 60_000, 0)).not.toThrow();
    expect(() => l.check('promo', 'a', 3, 60_000, 0)).not.toThrow();
  });
  it('starts a fresh window after the time is up', () => {
    const l = new RateLimiter();
    for (let i = 0; i < 3; i++) l.check('t', 'a', 3, 1000, 0);
    expect(() => l.check('t', 'a', 3, 1000, 1001)).not.toThrow();
  });
  it('reads the client address from x-forwarded-for', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }, ip: '127.0.0.1' } as never)).toBe('9.9.9.9');
    expect(clientIp({ headers: {}, ip: '127.0.0.1' } as never)).toBe('127.0.0.1');
  });
});
