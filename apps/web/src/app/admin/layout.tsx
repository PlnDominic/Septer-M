import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AdminProvider } from '@/lib/admin/store';
import { AdminShell } from '@/components/admin/shell';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Septer-M Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
