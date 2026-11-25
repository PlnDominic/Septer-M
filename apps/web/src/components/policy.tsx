import type { ReactNode } from 'react';
import Link from 'next/link';
import { LEGAL_UPDATED } from '@/lib/site';

/** Shared layout for the plain-text pages (delivery, returns, privacy, terms). */
export function PolicyPage({ title, intro, updated = true, children }: { title: string; intro?: string; updated?: boolean; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <span>{title}</span>
      </nav>
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 text-lg text-muted">{intro}</p>}
      {updated && <p className="mt-2 text-xs text-muted">Last updated {LEGAL_UPDATED}</p>}
      <div className="mt-8 space-y-5 text-[15px] leading-relaxed [&_a]:underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_li+li]:mt-1.5">
        {children}
      </div>
    </div>
  );
}
