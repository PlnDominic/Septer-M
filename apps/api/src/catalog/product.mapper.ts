import type { Currency } from '@septer-m/shared';

interface PriceRow {
  currency: Currency;
  amount: number;
  compare_at: number | null;
}

/** A product row joined with its category slug and prices (see PRODUCT_SELECT). */
export interface ProductRow {
  slug: string;
  name: string;
  tagline: string;
  size_ml: number;
  skin_types: string[];
  concerns: string[];
  ingredients: string;
  how_to_use: string;
  image_path: string;
  is_new: boolean;
  best_seller: boolean;
  status: 'draft' | 'active';
  stock: number;
  rating_value: number | string;
  rating_count: number;
  category: { slug: string } | { slug: string }[] | null;
  prices: PriceRow[] | null;
}

export const PRODUCT_SELECT =
  'slug, name, tagline, size_ml, skin_types, concerns, ingredients, how_to_use, image_path, is_new, best_seller, status, stock, rating_value, rating_count, category:categories(slug), prices:product_prices(currency, amount, compare_at)';

export interface ProductDto {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  sizeMl: number;
  price: Record<Currency, number>;
  compareAt?: Record<Currency, number>;
  skinTypes: string[];
  concerns: string[];
  ingredients: string;
  howToUse: string;
  image: string;
  isNew: boolean;
  bestSeller: boolean;
  rating: { value: number; count: number };
  inStock: boolean;
  /** Units left when running low (1-5), otherwise null. Exact stock is never exposed publicly. */
  lowStock: number | null;
}

export interface AdminProductDto extends ProductDto {
  status: 'draft' | 'active';
  stock: number;
}

/** Shoppers see "only N left" at or below this many units. */
export const LOW_STOCK_THRESHOLD = 5;

const categorySlug = (c: ProductRow['category']) => (Array.isArray(c) ? c[0]?.slug : c?.slug) ?? '';

export function toProductDto(row: ProductRow): ProductDto {
  const price = {} as Record<Currency, number>;
  const was: Partial<Record<Currency, number>> = {};
  for (const p of row.prices ?? []) {
    price[p.currency] = p.amount;
    if (p.compare_at) was[p.currency] = p.compare_at;
  }
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    category: categorySlug(row.category),
    sizeMl: row.size_ml,
    price,
    ...(was.GBP && was.GHS ? { compareAt: { GBP: was.GBP, GHS: was.GHS } } : {}),
    skinTypes: row.skin_types,
    concerns: row.concerns,
    ingredients: row.ingredients,
    howToUse: row.how_to_use,
    image: row.image_path,
    isNew: row.is_new,
    bestSeller: row.best_seller,
    rating: { value: Number(row.rating_value), count: row.rating_count },
    inStock: row.stock > 0,
    lowStock: row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD ? row.stock : null,
  };
}

export const toAdminProductDto = (row: ProductRow): AdminProductDto => ({ ...toProductDto(row), status: row.status, stock: row.stock });

export interface ProductFilter {
  category?: string;
  collection?: 'new' | 'best';
  q?: string;
}

/** Catalogue is small, so filtering happens in memory (swap for SQL if it grows into the thousands). */
export function filterProducts<T extends ProductDto>(products: T[], f: ProductFilter): T[] {
  const term = f.q?.trim().toLowerCase();
  return products.filter((p) => {
    if (f.category && p.category !== f.category) return false;
    if (f.collection === 'new' && !p.isNew) return false;
    if (f.collection === 'best' && !p.bestSeller) return false;
    if (term && !`${p.name} ${p.tagline} ${p.ingredients} ${p.concerns.join(' ')} ${p.skinTypes.join(' ')}`.toLowerCase().includes(term)) return false;
    return true;
  });
}
