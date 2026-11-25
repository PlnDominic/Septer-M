'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { searchProducts } from '@septer-m/shared';
import { PRODUCTS } from '@/lib/products';
import { formatMoney } from '@/lib/money';
import { useShop } from './providers';
import { SearchIcon } from './icons';

const MAX_SUGGESTIONS = 5;

/** Search field with live suggestions (combobox pattern: arrow keys, Enter, Escape). */
export function SearchBox({ autoFocus, onDone, className = '' }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const router = useRouter();
  const { currency } = useShop();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const term = q.trim();
  const found = useMemo(() => (term.length >= 2 ? searchProducts(PRODUCTS, term) : null), [term]);
  const suggestions = found?.results.slice(0, MAX_SUGGESTIONS) ?? [];
  // options: each suggestion, then "see all results"
  const optionCount = term.length >= 2 ? suggestions.length + 1 : 0;

  const finish = () => {
    setOpen(false);
    setActive(-1);
    onDone?.();
  };
  const goAll = () => {
    if (!term) return;
    router.push(`/shop?q=${encodeURIComponent(term)}`);
    finish();
  };
  const goProduct = (slug: string) => {
    router.push(`/product/${slug}`);
    setQ('');
    finish();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (optionCount ? (a + 1) % optionCount : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (optionCount ? (a <= 0 ? optionCount - 1 : a - 1) : -1));
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && active < suggestions.length) goProduct(suggestions[active].slug);
      else goAll();
    }
  };

  const showList = open && term.length >= 2;

  return (
    <div
      className={`relative ${className}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div role="search" className="flex items-center gap-2 rounded-full border border-line bg-white px-4 focus-within:border-ink focus-within:ring-2 focus-within:ring-brand">
        <SearchIcon width={18} height={18} />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search products, skin concerns…"
          aria-label="Search products"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          style={{ outline: 'none' }}
          className="h-11 min-w-0 flex-1 bg-transparent text-[16px] sm:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>

      {showList && (
        <ul id={listId} role="listbox" aria-label="Search suggestions" className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          {suggestions.map((p, i) => (
            <li key={p.slug} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goProduct(p.slug)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${active === i ? 'bg-mist' : 'hover:bg-mist'}`}
              >
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-line">
                  <Image src={p.image} alt="" fill sizes="44px" className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{p.tagline}</span>
                </span>
                <span className="text-sm">{formatMoney(p.price[currency], currency)}</span>
              </button>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li role="presentation" className="px-4 py-3 text-sm text-muted">No matches yet. Try a skin concern like “acne”, “dry skin” or “dark spots”.</li>
          )}
          {found?.correctedQuery && suggestions.length > 0 && (
            <li role="presentation" className="border-b border-line px-4 py-2 text-xs text-muted">Showing results for “{found.correctedQuery}”</li>
          )}
          <li id={`${listId}-${suggestions.length}`} role="option" aria-selected={active === suggestions.length}>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={goAll}
              className={`w-full border-t border-line px-4 py-3 text-left text-sm font-medium ${active === suggestions.length ? 'bg-mist' : 'hover:bg-mist'}`}
            >
              See all results for “{term}”
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
