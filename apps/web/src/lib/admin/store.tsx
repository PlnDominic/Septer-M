'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PLACED_KEY, type Order } from '@/lib/order';
import { api, apiEnabled, orderErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { demoOrders, demoProducts } from './demo-data';
import type { AdminOrder, AdminProduct, OrderStatus } from './types';

/*
 * Admin data. With the API configured it is loaded from (and saved to) the shop's database, and only
 * signed-in admins ever get here (see AdminGate). Without the API it is a browser-only demo.
 * Components talk to this hook rather than to storage or the API directly.
 */

const KEY = 'sm.admin.v1';

interface AdminData {
  products: AdminProduct[];
  orders: AdminOrder[];
}

/** Mutations resolve to an error message to show, or null on success. */
interface AdminState extends AdminData {
  ready: boolean;
  /** True when talking to the real shop (not the browser demo). */
  live: boolean;
  /** Why the data could not be loaded, if it could not. */
  loadError: string | null;
  reload: () => void;
  setOrderStatus: (number: string, status: OrderStatus, note?: string) => Promise<string | null>;
  saveProduct: (product: AdminProduct, originalSlug?: string) => Promise<string | null>;
  deleteProduct: (slug: string) => Promise<string | null>;
  reset: () => void;
}

const AdminContext = createContext<AdminState | null>(null);

function fresh(): AdminData {
  return { products: demoProducts(), orders: demoOrders() };
}

/** Pull in orders placed through the storefront checkout in this browser. */
function withPlacedOrders(data: AdminData): AdminData {
  try {
    const placed = JSON.parse(localStorage.getItem(PLACED_KEY) ?? '[]') as Order[];
    const known = new Set(data.orders.map((o) => o.number));
    const added: AdminOrder[] = placed
      .filter((o) => !known.has(o.number))
      .map((o) => ({ ...o, status: 'pending_payment', history: [{ status: 'pending_payment', at: o.createdAt, note: 'Placed on storefront' }] }));
    return added.length ? { ...data, orders: [...added, ...data.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) } : data;
  } catch {
    return data;
  }
}

const MAX_ORDERS = 500;

export function AdminProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const live = apiEnabled;
  const [data, setData] = useState<AdminData>({ products: [], orders: [] });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // Demo mode: restore from this browser.
  useEffect(() => {
    if (live) return;
    let stored: AdminData | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      stored = raw ? (JSON.parse(raw) as AdminData) : null;
    } catch {
      /* fall through to fresh data */
    }
    setData(withPlacedOrders(stored ?? fresh()));
    setReady(true);
  }, [live]);

  useEffect(() => {
    if (live || !ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable - changes last for this visit only */
    }
  }, [data, ready, live]);

  // Live mode: load products and the most recent orders from the shop.
  useEffect(() => {
    if (!live || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const products = await api<AdminProduct[]>('/admin/products', { token });
        const orders: AdminOrder[] = [];
        for (let offset = 0; offset < MAX_ORDERS; offset += 100) {
          const page = await api<{ total: number; orders: AdminOrder[] }>(`/admin/orders?limit=100&offset=${offset}`, { token });
          orders.push(...page.orders);
          if (orders.length >= page.total || page.orders.length === 0) break;
        }
        if (cancelled) return;
        setData({ products, orders });
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(orderErrorMessage(e));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, token, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const setOrderStatus = useCallback(
    async (number: string, status: OrderStatus, note?: string): Promise<string | null> => {
      if (live) {
        try {
          await api(`/admin/orders/${encodeURIComponent(number)}/status`, { body: { status, note: note || undefined }, token });
          const fresh = await api<AdminOrder>(`/admin/orders/${encodeURIComponent(number)}`, { token });
          setData((d) => ({ ...d, orders: d.orders.map((o) => (o.number === number ? fresh : o)) }));
          return null;
        } catch (e) {
          return orderErrorMessage(e);
        }
      }
      setData((d) => ({
        ...d,
        orders: d.orders.map((o) =>
          o.number === number && o.status !== status
            ? { ...o, status, history: [...o.history, { status, at: new Date().toISOString(), note: note || undefined }] }
            : o,
        ),
      }));
      return null;
    },
    [live, token],
  );

  const saveProduct = useCallback(
    async (product: AdminProduct, originalSlug?: string): Promise<string | null> => {
      if (live) {
        try {
          const body = { ...product, imagePath: product.image };
          const saved = originalSlug
            ? await api<AdminProduct>(`/admin/products/${encodeURIComponent(originalSlug)}`, { method: 'PUT', body, token })
            : await api<AdminProduct>('/admin/products', { body, token });
          setData((d) => {
            const exists = originalSlug && d.products.some((p) => p.slug === originalSlug);
            return { ...d, products: exists ? d.products.map((p) => (p.slug === originalSlug ? saved : p)) : [...d.products, saved] };
          });
          return null;
        } catch (e) {
          return orderErrorMessage(e);
        }
      }
      setData((d) => {
        const exists = originalSlug && d.products.some((p) => p.slug === originalSlug);
        return { ...d, products: exists ? d.products.map((p) => (p.slug === originalSlug ? product : p)) : [...d.products, product] };
      });
      return null;
    },
    [live, token],
  );

  const deleteProduct = useCallback(
    async (slug: string): Promise<string | null> => {
      if (live) {
        try {
          await api(`/admin/products/${encodeURIComponent(slug)}`, { method: 'DELETE', token });
        } catch (e) {
          return orderErrorMessage(e);
        }
      }
      setData((d) => ({ ...d, products: d.products.filter((p) => p.slug !== slug) }));
      return null;
    },
    [live, token],
  );

  const reset = useCallback(() => setData(withPlacedOrders(fresh())), []);

  const value = useMemo(
    () => ({ ...data, ready, live, loadError, reload, setOrderStatus, saveProduct, deleteProduct, reset }),
    [data, ready, live, loadError, reload, setOrderStatus, saveProduct, deleteProduct, reset],
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminState {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
  return ctx;
}
