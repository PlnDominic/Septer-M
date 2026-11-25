'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { TextField } from '@/components/checkout/fields';

export default function ResetPassword() {
  const { configured, loading, session, recovering, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setError(null);
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) setError(res.error);
    else setDone(true);
  };

  let body;
  if (!configured) body = <p className="text-sm text-muted">Sign-in isn’t switched on yet.</p>;
  else if (loading) body = <p className="text-sm text-muted">Loading…</p>;
  else if (done)
    body = (
      <p role="status" className="rounded-lg bg-mist px-3 py-2 text-sm">
        Your password has been updated. <Link href="/account" className="underline">Go to your account</Link>.
      </p>
    );
  else if (!session || !recovering)
    body = (
      <p className="text-sm text-muted">
        This page opens from the link in your reset email. The link may have expired. <Link href="/account" className="underline">Request a new one</Link>.
      </p>
    );
  else
    body = (
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField id="new-password" label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
        <TextField id="confirm-password" label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy} className="h-11 w-full rounded-lg bg-ink font-medium text-white transition hover:bg-brand hover:text-ink disabled:opacity-50">
          {busy ? 'Please wait…' : 'Save new password'}
        </button>
      </form>
    );

  return (
    <div className="mx-auto max-w-md py-12 sm:py-16">
      <h1 className="mb-6 text-2xl sm:text-3xl">Choose a new password</h1>
      {body}
    </div>
  );
}
