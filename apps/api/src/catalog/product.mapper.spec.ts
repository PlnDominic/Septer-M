import { filterProducts, toAdminProductDto, toProductDto, type ProductRow } from './product.mapper';

const row = (over: Partial<ProductRow> = {}): ProductRow => ({
  slug: 'vit-c',
  name: 'Vitamin C Serum',
  tagline: 'Brighter',
  size_ml: 30,
  skin_types: ['Dull'],
  concerns: ['Dark spots'],
  ingredients: 'Aqua, Niacinamide',
  how_to_use: 'Morning',
  image_path: '/images/products/vit-c.jpg',
  is_new: true,
  best_seller: false,
  status: 'active',
  stock: 5,
  rating_value: '4.7',
  rating_count: 94,
  category: { slug: 'serum' },
  prices: [
    { currency: 'GBP', amount: 2800, compare_at: null },
    { currency: 'GHS', amount: 36000, compare_at: null },
  ],
  ...over,
});

describe('toProductDto', () => {
  it('maps columns to the storefront shape', () => {
    expect(toProductDto(row())).toEqual({
      slug: 'vit-c', name: 'Vitamin C Serum', tagline: 'Brighter', category: 'serum', sizeMl: 30,
      price: { GBP: 2800, GHS: 36000 }, skinTypes: ['Dull'], concerns: ['Dark spots'], ingredients: 'Aqua, Niacinamide',
      howToUse: 'Morning', image: '/images/products/vit-c.jpg', isNew: true, bestSeller: false,
      rating: { value: 4.7, count: 94 }, inStock: true, lowStock: 5,
    });
  });

  it('does not expose stock counts or status publicly', () => {
    const dto = toProductDto(row());
    expect(dto).not.toHaveProperty('stock');
    expect(dto).not.toHaveProperty('status');
    expect(toAdminProductDto(row())).toMatchObject({ stock: 5, status: 'active' });
  });

  it('reports out of stock', () => {
    expect(toProductDto(row({ stock: 0 })).inStock).toBe(false);
    expect(toProductDto(row({ stock: 0 })).lowStock).toBeNull();
  });

  it('flags "only N left" at 1-5 units and never exposes larger counts', () => {
    for (const n of [1, 3, 5]) expect(toProductDto(row({ stock: n })).lowStock).toBe(n);
    for (const n of [6, 42]) expect(toProductDto(row({ stock: n })).lowStock).toBeNull();
  });

  it('includes compareAt only when both currencies have one', () => {
    const both = row({ prices: [{ currency: 'GBP', amount: 1700, compare_at: 2000 }, { currency: 'GHS', amount: 22000, compare_at: 26000 }] });
    expect(toProductDto(both).compareAt).toEqual({ GBP: 2000, GHS: 26000 });
    const one = row({ prices: [{ currency: 'GBP', amount: 1700, compare_at: 2000 }, { currency: 'GHS', amount: 22000, compare_at: null }] });
    expect(toProductDto(one)).not.toHaveProperty('compareAt');
  });

  it('handles the category embedded as an array', () => {
    expect(toProductDto(row({ category: [{ slug: 'mask' }] })).category).toBe('mask');
  });
});

describe('filterProducts', () => {
  const list = [
    toProductDto(row()),
    toProductDto(row({ slug: 'cleanser', name: 'Gel Cleanser', category: { slug: 'cleanser' }, is_new: false, best_seller: true, ingredients: 'Glycerin' })),
  ];
  it('filters by category, collection and search text', () => {
    expect(filterProducts(list, { category: 'cleanser' }).map((p) => p.slug)).toEqual(['cleanser']);
    expect(filterProducts(list, { collection: 'new' }).map((p) => p.slug)).toEqual(['vit-c']);
    expect(filterProducts(list, { collection: 'best' }).map((p) => p.slug)).toEqual(['cleanser']);
    expect(filterProducts(list, { q: 'niacinamide' }).map((p) => p.slug)).toEqual(['vit-c']);
    expect(filterProducts(list, {})).toHaveLength(2);
  });
});
