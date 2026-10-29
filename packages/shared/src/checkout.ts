import { z } from 'zod';
import type { Currency, Region } from './index';

export const GH_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East',
  'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
] as const;
export type GhRegion = (typeof GH_REGIONS)[number];

export const MOMO_NETWORKS = [
  { id: 'mtn', label: 'MTN MoMo' },
  { id: 'telecel', label: 'Telecel Cash' },
  { id: 'airteltigo', label: 'AirtelTigo Money' },
] as const;
export type MomoNetwork = (typeof MOMO_NETWORKS)[number]['id'];

/* ---------- Shipping (placeholder rates - confirm with the business) ---------- */

export interface ShippingOption {
  id: string;
  label: string;
  detail: string;
  /** Minor units. */
  price: number;
  /** Free when the subtotal (minor units) reaches this amount. */
  freeOver?: number;
}

export const FREE_SHIPPING_OVER: Record<Currency, number> = { GBP: 4000, GHS: 50000 };

export function shippingOptions(region: Region, ghRegion?: string): ShippingOption[] {
  if (region === 'UK') {
    return [
      { id: 'uk-standard', label: 'Standard delivery', detail: '2–4 working days', price: 395, freeOver: FREE_SHIPPING_OVER.GBP },
      { id: 'uk-express', label: 'Express delivery', detail: 'Next working day if ordered by 1pm', price: 695 },
    ];
  }
  return ghRegion === 'Greater Accra'
    ? [{ id: 'gh-accra', label: 'Accra & Tema delivery', detail: '1–2 working days', price: 3500, freeOver: FREE_SHIPPING_OVER.GHS }]
    : [{ id: 'gh-regional', label: 'Regional delivery', detail: '2–5 working days', price: 6000, freeOver: FREE_SHIPPING_OVER.GHS }];
}

export const shippingCost = (option: ShippingOption, subtotal: number): number =>
  option.freeOver !== undefined && subtotal >= option.freeOver ? 0 : option.price;

/* ---------- Validation ---------- */

const required = (label: string) => z.string().trim().min(1, `Enter your ${label}`);

const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|GIR ?0AA)$/i;
/** Ghana mobile numbers: 0XXXXXXXXX or +233XXXXXXXXX (spaces allowed). */
const GH_MOBILE = /^(?:\+?233|0)[25]\d{8}$/;
/** GhanaPostGPS digital address, e.g. GA-123-4567. */
const GH_DIGITAL_ADDRESS = /^[A-Z]{2}-\d{3,4}-\d{4}$/i;

const ghPhone = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(GH_MOBILE, 'Enter a Ghana mobile number, e.g. 024 123 4567'));

export const ukAddressSchema = z.object({
  firstName: required('first name'),
  lastName: required('last name'),
  line1: required('address'),
  line2: z.string().trim().optional(),
  city: required('town or city'),
  postcode: z.string().trim().regex(UK_POSTCODE, 'Enter a valid UK postcode'),
  phone: z.string().trim().optional(),
});

export const ghAddressSchema = z.object({
  firstName: required('first name'),
  lastName: required('last name'),
  phone: ghPhone,
  region: z.enum(GH_REGIONS, { error: 'Choose your region' }),
  city: required('town or city'),
  area: required('area or landmark'),
  digitalAddress: z
    .string()
    .trim()
    .refine((v) => v === '' || GH_DIGITAL_ADDRESS.test(v), 'Use the format GA-123-4567')
    .optional(),
});

const email = z.string().trim().email('Enter a valid email address');
const shippingId = z.string().min(1, 'Choose a delivery option');

export const checkoutSchema = z.discriminatedUnion('region', [
  z.object({
    region: z.literal('UK'),
    email,
    address: ukAddressSchema,
    shippingId,
    payment: z.object({ method: z.literal('card') }),
  }),
  z.object({
    region: z.literal('GH'),
    email,
    address: ghAddressSchema,
    shippingId,
    payment: z.discriminatedUnion('method', [
      z.object({ method: z.literal('card') }),
      z.object({
        method: z.literal('momo'),
        network: z.enum(['mtn', 'telecel', 'airteltigo'], { error: 'Choose your network' }),
        phone: ghPhone,
      }),
    ]),
  }),
]);

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
export type UkAddress = z.output<typeof ukAddressSchema>;
export type GhAddress = z.output<typeof ghAddressSchema>;
