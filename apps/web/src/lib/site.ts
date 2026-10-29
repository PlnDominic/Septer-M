import type { Currency } from '@septer-m/shared';

/** Placeholder policy values - confirm with the business before launch. */
export const FREE_SHIPPING_OVER: Record<Currency, number> = { GBP: 4000, GHS: 50000 };
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
