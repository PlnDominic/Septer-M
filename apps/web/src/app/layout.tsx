import type { ReactNode } from 'react';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { SITE_URL } from '@/lib/site-url';

const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-poppins', display: 'swap' });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Septer-M · Skincare', template: '%s · Septer-M' },
  description: 'Simple, effective skincare delivered to the UK and Ghana.',
  openGraph: {
    type: 'website',
    siteName: 'Septer-M',
    title: 'Septer-M · Skincare',
    description: 'Simple, effective skincare delivered to the UK and Ghana.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Septer-M' }],
  },
  twitter: { card: 'summary_large_image' as const },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      {/* Flex column so the footer sits at the bottom of the window on short pages. */}
      <body className="flex min-h-screen flex-col overflow-x-clip">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
