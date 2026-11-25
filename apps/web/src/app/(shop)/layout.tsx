import type { ReactNode } from 'react';
import { AnnouncementBar } from '@/components/announcement-bar';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { RegionSuggestion } from '@/components/region-suggestion';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only z-[60] rounded-lg bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to main content</a>
      <AnnouncementBar />
      <RegionSuggestion />
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 outline-none">{children}</main>
      <Footer />
    </>
  );
}
