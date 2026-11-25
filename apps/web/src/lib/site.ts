export { FREE_SHIPPING_OVER } from '@septer-m/shared';

/** Placeholder policy values - confirm with the business before launch. */
export const RETURN_DAYS = 30;

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/shop?collection=new', label: 'New Arrivals' },
  { href: '/shop?collection=best', label: 'Best Sellers' },
];
export const NAV_AFTER = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/** When the policy pages were last reviewed. Update when their wording changes. */
export const LEGAL_UPDATED = '25 November 2026';

/** Price filter bands per currency (minor units): under the first value, between, over the second. */
export const PRICE_BANDS = { GBP: [1500, 2500], GHS: [20000, 30000] } as const;
