import { z } from 'zod';
import { cartLineSchema, promoCodeSchema } from './checkout';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

/** Check a promo code against the current bag (the server works out the discount). */
export const promoValidateSchema = z.object({
  code: promoCodeSchema,
  email: email.optional().or(z.literal('').transform(() => undefined)),
  region: z.enum(['UK', 'GH']),
  items: z.array(cartLineSchema).min(1).max(30),
});

/** Why a promo code was refused, as machine-readable reasons from the database. */
export type PromoReason =
  | 'NOT_FOUND' | 'INACTIVE' | 'NOT_STARTED' | 'EXPIRED' | 'USED_UP' | 'MIN_SUBTOTAL'
  | 'FIRST_ORDER_ONLY' | 'ALREADY_USED' | 'EMAIL_REQUIRED';

export const trackOrderSchema = z.object({
  number: z.string().trim().toUpperCase().regex(/^SM-\d{3,12}$/, 'Enter your order number, like SM-1001'),
  email,
});

export const subscribeSchema = z.object({
  email,
  source: z.string().trim().max(40).optional(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Choose a star rating').max(5),
  title: z.string().trim().max(120).default(''),
  body: z.string().trim().min(10, 'Please write at least 10 characters').max(2000),
  name: z.string().trim().min(1, 'Enter the name to show').max(60),
});
export type ReviewInput = z.input<typeof reviewSchema>;

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const reviewStatusSchema = z.object({ status: z.enum(REVIEW_STATUSES) });

export const adminDiscountSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,32}$/, 'Use 3–32 letters, numbers or hyphens'),
    description: z.string().trim().max(200).default(''),
    kind: z.enum(['percent', 'fixed']),
    percent: z.number().int().min(1).max(100).optional(),
    amountGbp: z.number().int().positive().optional(),
    amountGhs: z.number().int().positive().optional(),
    minSubtotalGbp: z.number().int().min(0).default(0),
    minSubtotalGhs: z.number().int().min(0).default(0),
    maxUses: z.number().int().positive().optional(),
    firstOrderOnly: z.boolean().default(false),
    onePerEmail: z.boolean().default(true),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
  })
  .refine((d) => (d.kind === 'percent' ? d.percent !== undefined : d.amountGbp !== undefined && d.amountGhs !== undefined), {
    message: 'A percentage code needs a percent; a fixed code needs an amount in both £ and GH₵',
    path: ['kind'],
  });
export type AdminDiscountInput = z.input<typeof adminDiscountSchema>;
