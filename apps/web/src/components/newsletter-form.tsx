'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, apiEnabled, orderErrorMessage } from '@/lib/api';

/** Footer signup. Joining emails a one-off 10% welcome code; the server replies the same for new and existing addresses. */
export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });
  if (!apiEnabled) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ kind: 'busy' });
    try {
      const res = await api<{ message: string }>('/subscribe', { body: { email: email.trim(), source: 'footer' } });
      setState({ kind: 'ok', text: res.message });
      setEmail('');
    } catch (err) {
      setState({ kind: 'error', text: orderErrorMessage(err) });
    }
  };

  return (
    <div className="border-t border-white/15">
      <form onSubmit={submit} noValidate className="mx-auto max-w-6xl px-4 py-8">
        <h3 className="text-sm">Get 10% off your first order</h3>
        <p className="mt-1 text-xs text-white/60">Join our email list for skincare tips and offers. Unsubscribe any time. See our <Link href="/privacy" className="underline">privacy policy</Link>.</p>
        <div className="mt-3 flex max-w-md gap-2">
          <label htmlFor="newsletter-email" className="sr-only">Email address</label>
          <input
            id="newsletter-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/25 bg-white/10 px-3 text-sm text-white placeholder:text-white/50"
          />
          <button type="submit" disabled={state.kind === 'busy' || !email.trim()} className="h-11 rounded-xl bg-brand px-5 text-sm font-medium text-ink transition hover:bg-white disabled:opacity-50">
            {state.kind === 'busy' ? 'Joining…' : 'Join'}
          </button>
        </div>
        {state.text && <p role={state.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${state.kind === 'error' ? 'text-red-300' : 'text-green-300'}`}>{state.text}</p>}
      </form>
    </div>
  );
}
