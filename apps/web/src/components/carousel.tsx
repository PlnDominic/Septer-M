'use client';

import { useRef, type ReactNode } from 'react';
import { ChevronIcon } from './icons';

export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const arrow = 'absolute top-1/3 z-[1] hidden h-10 w-10 items-center justify-center rounded-full border border-line bg-card shadow md:flex hover:border-sage';

  return (
    <div className="relative">
      <button type="button" aria-label={`Previous ${label}`} onClick={() => scroll(-1)} className={`${arrow} -left-5`}><ChevronIcon dir="left" /></button>
      <div ref={ref} className="-mx-4 flex snap-x gap-5 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <button type="button" aria-label={`Next ${label}`} onClick={() => scroll(1)} className={`${arrow} -right-5`}><ChevronIcon /></button>
    </div>
  );
}
