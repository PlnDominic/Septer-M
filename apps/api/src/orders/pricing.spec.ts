import { priceOrder, PricingError, type PricedProductRow } from './pricing';

const product = (slug: string, gbp: number, ghs: number, status: 'active' | 'draft' = 'active'): PricedProductRow => ({
  slug,
  name: slug,
  status,
  prices: [
    { currency: 'GBP', amount: gbp },
    { currency: 'GHS', amount: ghs },
  ],
});
const products = [product('serum', 2800, 36000), product('cleanser', 1400, 18500), product('old', 1000, 10000, 'draft')];

describe('priceOrder', () => {
  it('sums line prices in the region currency and adds standard UK delivery', () => {
    const r = priceOrder({ items: [{ slug: 'serum', qty: 1 }], products, region: 'UK', shippingId: 'uk-standard' });
    expect(r).toMatchObject({ currency: 'GBP', subtotal: 2800, shippingCost: 395, total: 3195 });
  });

  it('merges duplicate lines', () => {
    const r = priceOrder({ items: [{ slug: 'serum', qty: 1 }, { slug: 'serum', qty: 2 }], products, region: 'UK', shippingId: 'uk-standard' });
    expect(r.subtotal).toBe(8400);
  });

  it('gives free standard delivery at the threshold but still charges for express', () => {
    const standard = priceOrder({ items: [{ slug: 'serum', qty: 2 }], products, region: 'UK', shippingId: 'uk-standard' });
    expect(standard).toMatchObject({ subtotal: 5600, shippingCost: 0, total: 5600 });
    const express = priceOrder({ items: [{ slug: 'serum', qty: 2 }], products, region: 'UK', shippingId: 'uk-express' });
    expect(express.shippingCost).toBe(695);
  });

  it('prices Ghana in GHS with the Accra or regional rate', () => {
    const accra = priceOrder({ items: [{ slug: 'cleanser', qty: 1 }], products, region: 'GH', ghRegion: 'Greater Accra', shippingId: 'gh-accra' });
    expect(accra).toMatchObject({ currency: 'GHS', subtotal: 18500, shippingCost: 3500 });
    const regional = priceOrder({ items: [{ slug: 'cleanser', qty: 1 }], products, region: 'GH', ghRegion: 'Ashanti', shippingId: 'gh-regional' });
    expect(regional.shippingCost).toBe(6000);
  });

  it('rejects an Accra delivery option for an Ashanti address', () => {
    expect(() => priceOrder({ items: [{ slug: 'cleanser', qty: 1 }], products, region: 'GH', ghRegion: 'Ashanti', shippingId: 'gh-accra' })).toThrow(
      expect.objectContaining({ code: 'INVALID_SHIPPING' }),
    );
  });

  it('rejects unknown and draft products', () => {
    for (const slug of ['missing', 'old']) {
      expect(() => priceOrder({ items: [{ slug, qty: 1 }], products, region: 'UK', shippingId: 'uk-standard' })).toThrow(
        expect.objectContaining({ code: 'PRODUCT_UNAVAILABLE', subject: slug }),
      );
    }
  });

  it('rejects a product with no price in the currency', () => {
    const noGhs: PricedProductRow[] = [{ slug: 'x', name: 'x', status: 'active', prices: [{ currency: 'GBP', amount: 100 }] }];
    expect(() => priceOrder({ items: [{ slug: 'x', qty: 1 }], products: noGhs, region: 'GH', ghRegion: 'Ashanti', shippingId: 'gh-regional' })).toThrow(PricingError);
  });
});
