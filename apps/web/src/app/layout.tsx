import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '@/components/providers';
import { AnnouncementBar } from '@/components/announcement-bar';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata = {
  title: { default: 'Septer-M · Skincare', template: '%s · Septer-M' },
  description: 'Simple, effective skincare delivered to the UK and Ghana.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AnnouncementBar />
          <Header />
          <main className="mx-auto max-w-6xl px-4">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
