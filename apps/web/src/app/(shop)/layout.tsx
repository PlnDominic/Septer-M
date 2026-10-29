import type { ReactNode } from 'react';
import { AnnouncementBar } from '@/components/announcement-bar';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4">{children}</main>
      <Footer />
    </>
  );
}
