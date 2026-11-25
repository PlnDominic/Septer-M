'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { AuthForms } from '@/components/account/auth-forms';
import { OrderHistory } from '@/components/account/order-history';

export default function Account() {
  const { configured, loading, user, profile, recovering, signOut } = useAuth();

  if (!configured) {
    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="text-2xl sm:text-3xl">Account</h1>
        <p role="note" className="mt-4 rounded-xl border border-brand bg-brand/10 px-4 py-3 text-sm">
          Sign-in isn’t switched on yet. It needs the store’s Supabase project to be connected (<code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>).
        </p>
      </div>
    );
  }

  if (loading) return <div className="mx-auto max-w-md py-16 text-sm text-muted" aria-live="polite">Loading…</div>;

  if (!user || recovering) {
    return (
      <div className="py-12 sm:py-16">
        {recovering ? (
          <div className="mx-auto max-w-md">
            <h1 className="text-2xl sm:text-3xl">Choose a new password</h1>
            <p className="mt-2 text-sm text-muted">You followed a reset link. <Link href="/account/reset" className="underline">Set your new password</Link>.</p>
          </div>
        ) : (
          <AuthForms />
        )}
      </div>
    );
  }

  const name = profile?.fullName || user.email;
  return (
    <div className="mx-auto max-w-2xl py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden />Signed in</p>
          <h1 className="mt-2 text-2xl sm:text-3xl">Hello, {name}</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {profile?.role === 'admin' && (
            <Link href="/admin" className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-ink hover:bg-ink hover:text-white">Open admin</Link>
          )}
          <button type="button" onClick={() => void signOut()} className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium hover:border-ink">Sign out</button>
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-lg">Your orders</h2>
      <OrderHistory />
    </div>
  );
}
