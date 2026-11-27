'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { apiEnabled } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4">
      <div className="max-w-md rounded-2xl border border-line bg-white p-8 text-center">
        <h1 className="text-2xl">{title}</h1>
        <div className="mt-3 space-y-4 text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}

/**
 * With the shop connected, the admin is for signed-in admins only. This hides the screens; the API
 * independently refuses every admin request from anyone who is not an admin, so this is a courtesy, not the lock.
 * Without the API it is the browser-only demo and everyone passes.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { configured, loading, user, profile, signOut } = useAuth();
  if (!apiEnabled) return <>{children}</>;

  if (!configured) {
    return <Notice title="Admin sign-in isn’t set up"><p>The shop needs its Supabase sign-in settings before the admin can be used.</p></Notice>;
  }
  if (loading || (user && !profile)) return <Notice title="Checking access…"><p>One moment.</p></Notice>;
  if (!user) {
    return (
      <Notice title="Sign in to the admin">
        <p>This area is for the shop team.</p>
        <Link href="/account?next=/admin" className="inline-block rounded-lg bg-ink px-5 py-2.5 font-medium text-white">Sign in</Link>
      </Notice>
    );
  }
  if (profile?.role !== 'admin') {
    return (
      <Notice title="You don’t have access">
        <p>You’re signed in as {user.email}, which isn’t an admin account.</p>
        <p className="space-x-4">
          <Link href="/" className="underline">Back to the shop</Link>
          <button type="button" onClick={() => void signOut()} className="underline">Sign out</button>
        </p>
      </Notice>
    );
  }
  return <>{children}</>;
}
