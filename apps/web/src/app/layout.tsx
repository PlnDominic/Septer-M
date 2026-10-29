import type { ReactNode } from 'react';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-poppins', display: 'swap' });

export const metadata = {
  title: { default: 'Septer-M · Skincare', template: '%s · Septer-M' },
  description: 'Simple, effective skincare delivered to the UK and Ghana.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      {/* Flex column so the footer sits at the bottom of the window on short pages. */}
      <body className="flex min-h-screen flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
