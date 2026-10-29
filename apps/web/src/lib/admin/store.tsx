'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PLACED_KEY, type Order } from '@/lib/order';
import { demoOrders, demoProducts } from './demo-data';
import type { AdminOrder, AdminProduct, OrderStatus } from './types';

/*
 * Browser-only admin store for the demo phase. Replaced by NestJS API calls
 * (backed by Supabase) once the backend exists - keep components talking to
 * this hook rather than to storage directly so the swap is local.
 */

const KEY = 'sm.admin.v1';

interface AdminData {
  products: AdminProduct[];
  orders: AdminOrder[];
}

interface AdminState extends AdminData {
  ready: boolean;
  setOrderStatus: (number: string, status: OrderStatus, note?: string) => void;
  saveProduct: (product: AdminProduct, originalSlug?: string) => void;
  deleteProduct: (slug: string) => void;
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

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>({ products: [], orders: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: AdminData | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      stored = raw ? (JSON.parse(raw) as AdminData) : null;
    } catch {
      /* fall through to fresh data */
    }
    setData(withPlacedOrders(stored ?? fresh()));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable - changes last for this visit only */
    }
  }, [data, ready]);

  const setOrderStatus = useCallback((number: string, status: OrderStatus, note?: string) => {
    setData((d) => ({
      ...d,
      orders: d.orders.map((o) =>
        o.number === number && o.status !== status
          ? { ...o, status, history: [...o.history, { status, at: new Date().toISOString(), note: note || undefined }] }
          : o,
      ),
    }));
  }, []);

  const saveProduct = useCallback((product: AdminProduct, originalSlug?: string) => {
    setData((d) => {
      const exists = originalSlug && d.products.some((p) => p.slug === originalSlug);
      return {
        ...d,
        products: exists ? d.products.map((p) => (p.slug === originalSlug ? product : p)) : [...d.products, product],
      };
    });
  }, []);

  const deleteProduct = useCallback((slug: string) => {
    setData((d) => ({ ...d, products: d.products.filter((p) => p.slug !== slug) }));
  }, []);

  const reset = useCallback(() => setData(withPlacedOrders(fresh())), []);

  const value = useMemo(
    () => ({ ...data, ready, setOrderStatus, saveProduct, deleteProduct, reset }),
    [data, ready, setOrderStatus, saveProduct, deleteProduct, reset],
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminState {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
  return ctx;
}
