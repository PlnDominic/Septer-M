'use client';

import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

/** Authenticated calls to the admin API for the pages that don't need the shared store. */
export function useAdminApi() {
  const { session } = useAuth();
  const token = session?.access_token;
  return useCallback(<T,>(path: string, body?: unknown, method?: 'GET' | 'POST' | 'PUT' | 'DELETE') => api<T>(`/admin${path}`, { body, method, token }), [token]);
}
