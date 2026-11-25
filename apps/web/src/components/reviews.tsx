'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, apiEnabled, orderErrorMessage } from '@/lib/api';
import { useAuth } from './auth-provider';

interface ReviewList {
  summary: { average: number; count: number; distribution: { stars: number; count: number }[] };
  reviews: { rating: number; title: string; body: string; name: string; date: string; verified: boolean }[];
}

const Stars = ({ n }: { n: number }) => (
  <span aria-label={`${n} out of 5 stars`} className="text-brand">
    {'★'.repeat(n)}<span className="text-line">{'★'.repeat(5 - n)}</span>
  </span>
);

/** Real reviews only: every one comes from a customer whose order shipped. Nothing is shown (and no stars) until there are some. */
export function Reviews({ slug, productName }: { slug: string; productName: string }) {
  const { session, user, configured } = useAuth();
  const [data, setData] = useState<ReviewList | null>(null);
  const [eligible, setEligible] = useState<{ canReview: boolean; reason?: string } | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; text?: string }>({ kind: 'idle' });
  const token = session?.access_token;

  useEffect(() => {
    if (!apiEnabled) return;
    api<ReviewList>(`/products/${slug}/reviews`).then(setData).catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    setEligible(null);
    if (!apiEnabled || !token) return;
    api<{ canReview: boolean; reason?: string }>(`/products/${slug}/reviews/eligibility`, { token })
      .then(setEligible)
      .catch(() => undefined);
  }, [slug, token]);

  useEffect(() => {
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
    const full = meta?.full_name ?? meta?.name ?? '';
    if (full) setName((n) => n || full.split(/\s+/).map((w, i) => (i === 0 ? w : `${w[0]}.`)).join(' '));
  }, [user]);

  if (!apiEnabled) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (rating < 1) return setStatus({ kind: 'error', text: 'Choose a star rating.' });
    if (body.trim().length < 10) return setStatus({ kind: 'error', text: 'Please write at least 10 characters.' });
    if (!name.trim()) return setStatus({ kind: 'error', text: 'Enter the name to show.' });
    setStatus({ kind: 'busy' });
    try {
      const res = await api<{ message: string }>(`/products/${slug}/reviews`, { body: { rating, title, body, name }, token });
      setStatus({ kind: 'done', text: res.message });
      setEligible({ canReview: false, reason: 'ALREADY_REVIEWED' });
    } catch (err) {
      setStatus({ kind: 'error', text: orderErrorMessage(err) });
    }
  };

  const count = data?.summary.count ?? 0;

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-20">
      <h2 id="reviews-heading" className="font-display text-2xl">Customer reviews</h2>

      {count > 0 && data ? (
        <div className="mt-6 grid gap-8 md:grid-cols-[220px_1fr]">
          <div>
            <p className="text-4xl font-semibold">{data.summary.average.toFixed(1)}</p>
            <Stars n={Math.round(data.summary.average)} />
            <p className="mt-1 text-sm text-muted">{count} verified {count === 1 ? 'review' : 'reviews'}</p>
            <ul className="mt-4 space-y-1 text-xs text-muted">
              {[...data.summary.distribution].reverse().map((d) => (
                <li key={d.stars} className="flex items-center gap-2">
                  <span className="w-6">{d.stars}★</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full bg-brand" style={{ width: `${(d.count / count) * 100}%` }} /></span>
                  <span className="w-5 text-right">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="divide-y divide-line">
            {data.reviews.map((r, i) => (
              <li key={i} className="py-5 first:pt-0">
                <div className="flex items-center gap-2 text-sm"><Stars n={r.rating} /><span className="font-medium">{r.title}</span></div>
                <p className="mt-2 text-sm">{r.body}</p>
                <p className="mt-2 text-xs text-muted">
                  {r.name} · {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{r.verified && ' · Verified purchase'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No reviews yet. Reviews come only from customers who have received this product.</p>
      )}

      <div className="mt-8 rounded-2xl border border-line p-5">
        {eligible?.canReview ? (
          <form onSubmit={submit} noValidate>
            <h3 className="text-base">Review {productName}</h3>
            <fieldset className="mt-3">
              <legend className="sr-only">Your rating</legend>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n} onClick={() => setRating(n)} className={`h-10 w-10 text-2xl ${n <= rating ? 'text-brand' : 'text-line'}`}>★</button>
                ))}
              </div>
            </fieldset>
            <div className="mt-3 grid gap-3">
              <input aria-label="Review title" placeholder="Title (optional)" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-xl border border-line bg-card px-3" />
              <textarea aria-label="Your review" placeholder="What did you think?" rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} className="rounded-xl border border-line bg-card p-3" />
              <input aria-label="Name to show" placeholder="Name to show, e.g. Ama K." maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl border border-line bg-card px-3" />
            </div>
            {status.kind === 'error' && <p role="alert" className="mt-2 text-sm text-red-700">{status.text}</p>}
            <button type="submit" disabled={status.kind === 'busy'} className="mt-4 rounded-full bg-ink px-6 py-2.5 font-medium text-white transition hover:bg-brand hover:text-ink disabled:opacity-50">
              {status.kind === 'busy' ? 'Sending…' : 'Submit review'}
            </button>
          </form>
        ) : status.kind === 'done' ? (
          <p role="status" className="text-sm">{status.text}</p>
        ) : eligible?.reason === 'ALREADY_REVIEWED' ? (
          <p className="text-sm text-muted">Thanks, you’ve already reviewed this product.</p>
        ) : (
          <p className="text-sm text-muted">
            {user
              ? 'You can review this product once you’ve received it.'
              : configured
                ? <>Bought this? <Link href={`/account?next=/product/${slug}`} className="underline">Sign in</Link> to leave a review.</>
                : 'Reviews can be left once you’ve received this product.'}
          </p>
        )}
      </div>
    </section>
  );
}
