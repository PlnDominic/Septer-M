import { toHttpError, unwrap } from './db-errors';

describe('toHttpError', () => {
  it.each([
    ['OUT_OF_STOCK', 409, 'OUT_OF_STOCK'],
    ['PRICE_CHANGED', 409, 'PRICE_CHANGED'],
    ['INVALID_TRANSITION', 409, 'INVALID_TRANSITION'],
    ['PRODUCT_UNAVAILABLE', 422, 'PRODUCT_UNAVAILABLE'],
    ['EMPTY_CART', 422, 'EMPTY_CART'],
    ['ORDER_NOT_FOUND', 404, 'ORDER_NOT_FOUND'],
    ['PRODUCT_NOT_FOUND', 404, 'PRODUCT_NOT_FOUND'],
  ])('maps %s to HTTP %i', (message, status, code) => {
    const e = toHttpError({ message, details: 'tonic', code: 'P0001' });
    expect(e.getStatus()).toBe(status);
    expect(e.getResponse()).toMatchObject({ code, detail: 'tonic' });
  });

  it('maps unique violations to 409', () => {
    expect(toHttpError({ message: 'duplicate key value', code: '23505' }).getStatus()).toBe(409);
  });

  it('hides unexpected database errors behind a generic 500', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const e = toHttpError({ message: 'relation "secret_table" does not exist', code: '42P01' });
    expect(e.getStatus()).toBe(500);
    expect(JSON.stringify(e.getResponse())).not.toContain('secret_table');
    spy.mockRestore();
  });

  it('unwrap returns data or throws', () => {
    expect(unwrap({ data: [1], error: null })).toEqual([1]);
    expect(() => unwrap({ data: null, error: { message: 'OUT_OF_STOCK' } })).toThrow();
  });
});
