import { REGION_CURRENCY, shippingCost, shippingOptions, type Currency, type Region, type ShippingOption } from '@septer-m/shared';

export interface PricedProductRow {
  slug: string;
  name: string;
  status: 'draft' | 'active';
  prices: { currency: Currency; amount: number }[] | null;
}

export type PricingErrorCode = 'PRODUCT_UNAVAILABLE' | 'NO_PRICE' | 'INVALID_SHIPPING';

export class PricingError extends Error {
  constructor(
    readonly code: PricingErrorCode,
    readonly subject?: string,
  ) {
    super(code);
  }
}

export interface OrderPricing {
  currency: Currency;
  subtotal: number;
  shipping: ShippingOption;
  shippingCost: number;
  total: number;
}

/** Sums the lines in the market's currency; throws if any product is missing, hidden or unpriced. */
export function priceItems(items: { slug: string; qty: number }[], products: PricedProductRow[], currency: Currency): number {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const qty = new Map<string, number>();
  for (const i of items) qty.set(i.slug, (qty.get(i.slug) ?? 0) + i.qty);

  let subtotal = 0;
  for (const [slug, n] of qty) {
    const product = bySlug.get(slug);
    if (!product || product.status !== 'active') throw new PricingError('PRODUCT_UNAVAILABLE', slug);
    const price = product.prices?.find((p) => p.currency === currency)?.amount;
    if (price === undefined) throw new PricingError('NO_PRICE', slug);
    subtotal += price * n;
  }
  return subtotal;
}

/**
 * Prices an order from live product data. The result is also sent to the database,
 * which re-checks the subtotal inside the transaction that reserves stock.
 * Free delivery is judged on the products total before any discount code.
 */
export function priceOrder(args: {
  items: { slug: string; qty: number }[];
  products: PricedProductRow[];
  region: Region;
  ghRegion?: string;
  shippingId: string;
}): OrderPricing {
  const currency = REGION_CURRENCY[args.region];
  const subtotal = priceItems(args.items, args.products, currency);

  const shipping = shippingOptions(args.region, args.ghRegion).find((o) => o.id === args.shippingId);
  if (!shipping) throw new PricingError('INVALID_SHIPPING', args.shippingId);
  const cost = shippingCost(shipping, subtotal);

  return { currency, subtotal, shipping, shippingCost: cost, total: subtotal + cost };
}
