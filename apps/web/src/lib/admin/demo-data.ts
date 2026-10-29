import { shippingCost, shippingOptions, type GhAddress, type MomoNetwork, type UkAddress } from '@septer-m/shared';
import { PRODUCTS } from '@/lib/products';
import type { AdminOrder, AdminProduct, OrderStatus } from './types';

/* Deterministic demo data so the admin is explorable before the API exists. */

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UK_PEOPLE = ['Amelia Hughes', 'Oliver Bennett', 'Priya Shah', 'Grace Okafor', 'Chloe Turner', 'James Patel', 'Zara Ahmed', 'Ella Morgan', 'Ruth Mensah', 'Sophie Clarke'];
const UK_PLACES = [
  { city: 'London', postcode: 'SE15 4QN', line1: '12 Rye Lane' },
  { city: 'Manchester', postcode: 'M14 5RL', line1: '48 Wilmslow Road' },
  { city: 'Birmingham', postcode: 'B5 7RN', line1: '7 Bristol Street' },
  { city: 'Leeds', postcode: 'LS6 2EX', line1: '91 Hyde Park Road' },
  { city: 'Bristol', postcode: 'BS1 6QH', line1: '3 Harbourside Walk' },
];
const GH_PEOPLE = ['Ama Owusu', 'Kwame Asante', 'Efua Boateng', 'Kofi Mensah', 'Akosua Darko', 'Yaw Agyeman', 'Abena Ofori', 'Kojo Appiah', 'Esi Quaye', 'Nana Adjei'];
const GH_PLACES = [
  { region: 'Greater Accra', city: 'Accra', area: 'East Legon, near A&C Mall', digitalAddress: 'GA-492-1875' },
  { region: 'Greater Accra', city: 'Tema', area: 'Community 25, near the lorry station', digitalAddress: 'GT-201-6634' },
  { region: 'Ashanti', city: 'Kumasi', area: 'Asokwa, behind the police station', digitalAddress: 'AK-039-2210' },
  { region: 'Central', city: 'Cape Coast', area: 'Abura, near the junction', digitalAddress: '' },
  { region: 'Western', city: 'Takoradi', area: 'Anaji, opposite the church', digitalAddress: 'WS-118-4402' },
] as const;
const NETWORKS: MomoNetwork[] = ['mtn', 'mtn', 'telecel', 'airteltigo'];

const STOCK = [42, 18, 7, 25, 3, 56, 12, 0];

export function demoProducts(): AdminProduct[] {
  return PRODUCTS.map((p, i) => ({ ...p, stock: STOCK[i % STOCK.length], status: 'active' }));
}

function statusFor(daysAgo: number, r: number): OrderStatus {
  if (r < 0.04) return 'cancelled';
  if (r < 0.07 && daysAgo > 4) return 'refunded';
  if (daysAgo < 1) return r < 0.35 ? 'pending_payment' : 'paid';
  if (daysAgo < 3) return r < 0.5 ? 'paid' : 'processing';
  if (daysAgo < 6) return 'shipped';
  return 'delivered';
}

const FLOW: OrderStatus[] = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered'];

function historyFor(status: OrderStatus, created: Date) {
  const steps: OrderStatus[] =
    status === 'cancelled' ? ['pending_payment', 'cancelled'] : status === 'refunded' ? [...FLOW, 'refunded'] : FLOW.slice(0, FLOW.indexOf(status) + 1);
  return steps.map((s, i) => ({ status: s, at: new Date(created.getTime() + i * 9 * 3600_000).toISOString() }));
}

export function demoOrders(now = new Date(), count = 48): AdminOrder[] {
  const r = seeded(20261029);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const orders: AdminOrder[] = [];

  for (let i = 0; i < count; i++) {
    const daysAgo = r() * 30;
    const created = new Date(now.getTime() - daysAgo * 86_400_000);
    const uk = r() < 0.55;
    const currency = uk ? 'GBP' : 'GHS';
    const [firstName, lastName] = pick(uk ? UK_PEOPLE : GH_PEOPLE).split(' ');
    const email = `${firstName}.${lastName}@example.com`.toLowerCase();

    const chosen = [...PRODUCTS].sort(() => r() - 0.5).slice(0, 1 + Math.floor(r() * 3));
    const lines = chosen.map((p) => ({ slug: p.slug, name: p.name, qty: r() < 0.8 ? 1 : 2, unitPrice: p.price[currency] }));
    const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);

    let address: UkAddress | GhAddress;
    if (uk) {
      const place = pick(UK_PLACES);
      address = { firstName, lastName, line1: place.line1, city: place.city, postcode: place.postcode };
    } else {
      const place = pick(GH_PLACES);
      const phone = `+23324${String(Math.floor(r() * 1e7)).padStart(7, '0')}`;
      address = { firstName, lastName, phone, ...place };
    }

    const options = shippingOptions(uk ? 'UK' : 'GH', 'region' in address ? address.region : undefined);
    const option = uk && r() < 0.25 ? options[1] : options[0];
    const cost = shippingCost(option, subtotal);
    const payment =
      !uk && r() < 0.7
        ? { method: 'momo' as const, network: pick(NETWORKS), phone: 'phone' in address && address.phone ? address.phone : '' }
        : { method: 'card' as const };
    const status = statusFor(daysAgo, r());

    orders.push({
      number: `SM-${Math.floor(created.getTime() / 1000).toString(36).toUpperCase().slice(-6)}${i}`,
      createdAt: created.toISOString(),
      region: uk ? 'UK' : 'GH',
      currency,
      email,
      address,
      payment,
      shipping: { id: option.id, label: option.label, detail: option.detail, cost },
      lines,
      subtotal,
      total: subtotal + cost,
      status,
      history: historyFor(status, created),
    } as AdminOrder);
  }
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
