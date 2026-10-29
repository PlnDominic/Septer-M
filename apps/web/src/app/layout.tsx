import type { ReactNode } from 'react';

export const metadata = {
  title: 'Septer-M',
  description: 'Skincare, made simple.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
