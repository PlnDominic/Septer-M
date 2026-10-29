import type { Currency } from '@septer-m/shared';

export type Category = 'cleanser' | 'serum' | 'moisturiser' | 'sunscreen' | 'mask';

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  category: Category;
  sizeMl: number;
  /** Minor units, set by hand per market (not converted live). */
  price: Record<Currency, number>;
  skinTypes: string[];
  concerns: string[];
  ingredients: string;
  howToUse: string;
  /** Path under /public. Stock photography until real product shots exist. */
  image: string;
  isNew: boolean;
  bestSeller: boolean;
  /** Original price per currency, if on sale (minor units). */
  compareAt?: Record<Currency, number>;
  /** Placeholder values until real reviews exist. */
  rating: { value: number; count: number };
}

export const CATEGORIES: { id: Category; label: string; image: string }[] = [
  { id: 'cleanser', label: 'Cleansers', image: '/images/lifestyle/cat-cleanser.jpg' },
  { id: 'serum', label: 'Serums', image: '/images/lifestyle/cat-serum.jpg' },
  { id: 'moisturiser', label: 'Moisturisers', image: '/images/lifestyle/cat-moisturiser.jpg' },
  { id: 'sunscreen', label: 'Sunscreen', image: '/images/lifestyle/cat-sunscreen.jpg' },
  { id: 'mask', label: 'Masks', image: '/images/lifestyle/cat-mask.jpg' },
];

// Placeholder catalogue - replaced by Supabase data in the catalogue phase.
const BASE: Omit<Product, 'isNew' | 'bestSeller' | 'compareAt' | 'rating' | 'image'>[] = [
  {
    slug: 'gentle-gel-cleanser',
    name: 'Gentle Gel Cleanser',
    tagline: 'Lifts dirt and SPF without stripping',
    category: 'cleanser',
    sizeMl: 150,
    price: { GBP: 1400, GHS: 18500 },
    skinTypes: ['All', 'Sensitive'],
    concerns: ['Everyday cleansing'],
    ingredients: 'Aqua, Glycerin, Coco-Glucoside, Aloe Barbadensis Leaf Juice, Panthenol, Allantoin',
    howToUse: 'Massage onto damp skin morning and evening, then rinse with lukewarm water.',
  },
  {
    slug: 'vitamin-c-brightening-serum',
    name: 'Vitamin C Brightening Serum',
    tagline: 'Visibly brighter, more even tone',
    category: 'serum',
    sizeMl: 30,
    price: { GBP: 2800, GHS: 36000 },
    skinTypes: ['Normal', 'Combination', 'Dull'],
    concerns: ['Dark spots', 'Dullness'],
    ingredients: 'Aqua, Ascorbyl Glucoside, Glycerin, Niacinamide, Sodium Hyaluronate, Ferulic Acid',
    howToUse: 'Apply 3-4 drops to clean skin in the morning, followed by moisturiser and SPF.',
  },
  {
    slug: 'niacinamide-clarifying-serum',
    name: 'Niacinamide Clarifying Serum',
    tagline: 'Balances oil and refines pores',
    category: 'serum',
    sizeMl: 30,
    price: { GBP: 1800, GHS: 23500 },
    skinTypes: ['Oily', 'Combination'],
    concerns: ['Blemishes', 'Excess oil', 'Pores'],
    ingredients: 'Aqua, Niacinamide, Zinc PCA, Propanediol, Panthenol, Allantoin',
    howToUse: 'Apply a few drops to clean skin morning or evening before moisturiser.',
  },
  {
    slug: 'barrier-repair-moisturiser',
    name: 'Barrier Repair Moisturiser',
    tagline: 'Rich, calming comfort for dry skin',
    category: 'moisturiser',
    sizeMl: 50,
    price: { GBP: 2200, GHS: 28500 },
    skinTypes: ['Dry', 'Sensitive'],
    concerns: ['Dryness', 'Redness'],
    ingredients: 'Aqua, Butyrospermum Parkii (Shea) Butter, Ceramide NP, Squalane, Glycerin, Panthenol',
    howToUse: 'Smooth over face and neck morning and night as the final step of your routine.',
  },
  {
    slug: 'light-gel-moisturiser',
    name: 'Light Gel Moisturiser',
    tagline: 'Weightless hydration that never feels greasy',
    category: 'moisturiser',
    sizeMl: 50,
    price: { GBP: 1900, GHS: 24500 },
    skinTypes: ['Oily', 'Combination', 'Normal'],
    concerns: ['Dehydration'],
    ingredients: 'Aqua, Sodium Hyaluronate, Glycerin, Aloe Barbadensis Leaf Juice, Squalane, Allantoin',
    howToUse: 'Apply to clean skin morning and evening.',
  },
  {
    slug: 'daily-sunscreen-spf-50',
    name: 'Daily Sunscreen SPF 50',
    tagline: 'Invisible on every skin tone',
    category: 'sunscreen',
    sizeMl: 50,
    price: { GBP: 1600, GHS: 21000 },
    skinTypes: ['All'],
    concerns: ['Sun protection', 'Dark spots'],
    ingredients: 'Aqua, Zinc Oxide, Caprylic/Capric Triglyceride, Glycerin, Tocopherol, Squalane',
    howToUse: 'Apply generously as the last step every morning and reapply every two hours in strong sun.',
  },
  {
    slug: 'overnight-hydration-mask',
    name: 'Overnight Hydration Mask',
    tagline: 'Wake up to plump, rested skin',
    category: 'mask',
    sizeMl: 75,
    price: { GBP: 2400, GHS: 31000 },
    skinTypes: ['Dry', 'Normal', 'Dull'],
    concerns: ['Dryness', 'Dullness'],
    ingredients: 'Aqua, Glycerin, Sodium Hyaluronate, Shea Butter, Squalane, Panthenol',
    howToUse: 'Apply a thin layer as the last step 2-3 nights a week. Rinse in the morning.',
  },
  {
    slug: 'clay-purifying-mask',
    name: 'Clay Purifying Mask',
    tagline: 'Deep clean without the tight feeling',
    category: 'mask',
    sizeMl: 75,
    price: { GBP: 1700, GHS: 22000 },
    skinTypes: ['Oily', 'Combination'],
    concerns: ['Blemishes', 'Pores'],
    ingredients: 'Aqua, Kaolin, Bentonite, Glycerin, Salicylic Acid, Allantoin',
    howToUse: 'Apply an even layer, leave 8-10 minutes, then rinse. Use once or twice weekly.',
  },
];

const META: Record<string, Pick<Product, 'isNew' | 'bestSeller' | 'compareAt' | 'rating'>> = {
  'gentle-gel-cleanser': { isNew: false, bestSeller: true, rating: { value: 4.8, count: 128 } },
  'vitamin-c-brightening-serum': { isNew: true, bestSeller: true, rating: { value: 4.7, count: 94 } },
  'niacinamide-clarifying-serum': { isNew: false, bestSeller: true, rating: { value: 4.6, count: 156 } },
  'barrier-repair-moisturiser': { isNew: true, bestSeller: false, rating: { value: 4.9, count: 71 } },
  'light-gel-moisturiser': { isNew: false, bestSeller: false, compareAt: { GBP: 2100, GHS: 27000 }, rating: { value: 4.5, count: 87 } },
  'daily-sunscreen-spf-50': { isNew: true, bestSeller: true, rating: { value: 4.8, count: 203 } },
  'overnight-hydration-mask': { isNew: true, bestSeller: false, rating: { value: 4.7, count: 58 } },
  'clay-purifying-mask': { isNew: false, bestSeller: false, compareAt: { GBP: 2000, GHS: 26000 }, rating: { value: 4.4, count: 66 } },
};

export const PRODUCTS: Product[] = BASE.map((p) => ({ ...p, ...META[p.slug], image: `/images/products/${p.slug}.jpg` }));

/** Original price before any sale, in minor units. */
export const compareAtPrice = (p: Product, currency: Currency): number | null => p.compareAt?.[currency] ?? null;

/** Whole-number percent saved in the given currency, if on sale. */
export const salePercent = (p: Product, currency: Currency): number | null => {
  const was = compareAtPrice(p, currency);
  return was ? Math.round((1 - p.price[currency] / was) * 100) : null;
};

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
