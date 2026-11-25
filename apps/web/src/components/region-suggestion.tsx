'use client';

import { useEffect, useState } from 'react';
import { useShop } from './providers';

const KEY = 'sm.regionPrompt';

/** True for browsers set to Ghana (locale or time zone). */
function looksLikeGhana(): boolean {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone === 'Africa/Accra' || navigator.languages.some((l) => /-GH$/i.test(l));
  } catch {
    return false;
  }
}

/** Offers GH₵ prices to visitors who look like they're in Ghana and haven't chosen a market yet. */
export function RegionSuggestion() {
  const { ready, region, setRegion } = useShop();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ready) return;
    try {
      const chosen = localStorage.getItem('sm.region') !== null;
      const dismissed = localStorage.getItem(KEY) !== null;
      setShow(!chosen && !dismissed && region === 'UK' && looksLikeGhana());
    } catch {
      setShow(false);
    }
  }, [ready, region]);

  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div role="region" aria-label="Choose your country" className="border-b border-brand/40 bg-brand/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
        <p>Shopping from Ghana? See prices in GH₵ and pay with Mobile Money.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setRegion('GH'); close(); }} className="h-9 rounded-lg bg-ink px-4 font-medium text-white hover:bg-brand hover:text-ink">Switch to Ghana</button>
          <button type="button" onClick={close} className="h-9 rounded-lg border border-line bg-white px-4 font-medium hover:border-ink">Stay on UK prices</button>
        </div>
      </div>
    </div>
  );
}
