'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, apiEnabled } from '@/lib/api';

function Unsub() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');

  useEffect(() => {
    if (!apiEnabled || !token) return void setState('failed');
    api(`/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(() => setState('done'))
      .catch(() => setState('failed'));
  }, [token]);

  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      {state === 'working' && <p className="text-muted">Unsubscribing…</p>}
      {state === 'done' && (
        <>
          <h1 className="text-3xl">You’re unsubscribed</h1>
          <p className="mt-3 text-muted">You won’t get any more marketing emails from us. Order emails (confirmations and shipping updates) will still reach you.</p>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1 className="text-3xl">We couldn’t unsubscribe you</h1>
          <p className="mt-3 text-muted">That link looks incomplete or has expired. <Link href="/contact" className="underline">Contact us</Link> and we’ll remove you by hand.</p>
        </>
      )}
      <Link href="/shop" className="mt-8 inline-block underline">Back to the shop</Link>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <Unsub />
    </Suspense>
  );
}
