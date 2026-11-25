import { z } from 'zod';

export const ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed next statuses; mirrors public.set_order_status in the database. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const setOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const CATEGORY_SLUGS = ['cleanser', 'serum', 'moisturiser', 'sunscreen', 'mask'] as const;

const money = z.number().int().positive('Enter a price above zero');

export const adminProductSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens'),
    name: z.string().trim().min(1, 'Enter a product name').max(120),
    tagline: z.string().trim().max(200).default(''),
    category: z.enum(CATEGORY_SLUGS),
    sizeMl: z.number().int().positive(),
    price: z.object({ GBP: money, GHS: money }),
    compareAt: z.object({ GBP: money, GHS: money }).optional(),
    skinTypes: z.array(z.string().trim().min(1)).max(10).default([]),
    concerns: z.array(z.string().trim().min(1)).max(10).default([]),
    ingredients: z.string().trim().max(4000).default(''),
    howToUse: z.string().trim().max(2000).default(''),
    imagePath: z.string().max(500).default(''),
    isNew: z.boolean().default(false),
    bestSeller: z.boolean().default(false),
    status: z.enum(['draft', 'active']),
    stock: z.number().int().min(0),
  })
  .refine((p) => !p.compareAt || (p.compareAt.GBP > p.price.GBP && p.compareAt.GHS > p.price.GHS), {
    message: 'Was price must be higher than the price',
    path: ['compareAt'],
  });

export type AdminProductInput = z.input<typeof adminProductSchema>;
export type AdminProductData = z.output<typeof adminProductSchema>;
