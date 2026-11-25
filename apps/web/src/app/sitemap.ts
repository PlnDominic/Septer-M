import type { MetadataRoute } from 'next';
import { PRODUCTS } from '@/lib/products';
import { SITE_URL } from '@/lib/site-url';

const PAGES = ['', '/shop', '/about', '/contact', '/shipping', '/returns', '/faq', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...PRODUCTS.map((p) => ({ url: `${SITE_URL}/product/${p.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
