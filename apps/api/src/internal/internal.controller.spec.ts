import { isValidCronAuth } from './internal.controller';

describe('isValidCronAuth', () => {
  const secret = 'a-long-enough-secret-value';
  it('accepts the exact bearer secret', () => expect(isValidCronAuth(`Bearer ${secret}`, secret)).toBe(true));
  it('rejects wrong, missing or malformed credentials', () => {
    expect(isValidCronAuth('Bearer nope-nope-nope-nope-nope', secret)).toBe(false);
    expect(isValidCronAuth(secret, secret)).toBe(false);
    expect(isValidCronAuth(undefined, secret)).toBe(false);
  });
  it('rejects everything when no secret is configured', () => {
    expect(isValidCronAuth('Bearer undefined', undefined)).toBe(false);
    expect(isValidCronAuth('Bearer ', '')).toBe(false);
  });
});
