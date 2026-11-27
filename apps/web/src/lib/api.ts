/** Address of the Septer-M API. When unset, the storefront runs in demo mode (static catalogue, no real orders). */
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export const apiEnabled = BASE !== '';

/** A failed API call, with the stable code the server sent (e.g. OUT_OF_STOCK) when there was one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; token?: string | null; signal?: AbortSignal } = {}): Promise<T> {
  if (!apiEnabled) throw new ApiError(0, 'API_NOT_CONFIGURED', 'The shop is not connected yet.');
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'We couldn’t reach the shop. Check your connection and try again.');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const body = (data ?? {}) as { code?: string; message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new ApiError(res.status, body.code ?? 'ERROR', message ?? 'Something went wrong. Please try again.', body as Record<string, unknown>);
  }
  return data as T;
}

/** What the server tells the storefront to do next to collect payment. */
export type PaymentAction =
  | { action: 'redirect'; provider: 'stripe' | 'paystack'; url: string }
  | { action: 'momo_prompt'; network: string; reference: string; message: string }
  | { action: 'momo_otp'; network: string; reference: string; message: string }
  | { action: 'none'; reason: 'PAYMENTS_NOT_CONFIGURED' }
  | { action: 'error'; message: string };

export interface PlacedOrder {
  number: string;
  token: string;
  currency: 'GBP' | 'GHS';
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  expiresAt: string;
  payment: PaymentAction;
}

export interface ServerOrder {
  number: string;
  status: 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  region: 'UK' | 'GH';
  currency: 'GBP' | 'GHS';
  email: string;
  address: Record<string, string | undefined>;
  payment: { method: 'card' | 'momo'; network?: string; phone?: string };
  shipping: { id: string; label: string; detail: string; cost: number };
  lines: { slug: string; name: string; qty: number; unitPrice: number }[];
  subtotal: number;
  discount: number;
  discountCode?: string;
  total: number;
  expiresAt: string | null;
  createdAt: string;
  history: { status: ServerOrder['status']; at: string; note?: string }[];
}

/** Friendly text for the errors a shopper can actually act on while placing an order. */
export function orderErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (e.code) {
    case 'OUT_OF_STOCK':
      return 'One of the items in your bag just sold out or has fewer left than you chose. Please review your bag.';
    case 'PRICE_CHANGED':
      return 'A price changed while you were checking out. Please review your bag and try again.';
    case 'PRODUCT_UNAVAILABLE':
      return 'One of the items in your bag is no longer available. Please review your bag.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a minute and try again.';
    default:
      return e.message;
  }
}
