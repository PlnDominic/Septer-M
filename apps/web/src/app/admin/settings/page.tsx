import { FREE_SHIPPING_OVER, shippingOptions } from '@septer-m/shared';
import { formatMoney } from '@/lib/money';
import { Card, PageHeader } from '@/components/admin/ui';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-sm first:border-t-0">
    <dt>{label}</dt>
    <dd className="text-muted">{children}</dd>
  </div>
);

const Pill = ({ on }: { on: boolean }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${on ? 'bg-green-100 text-green-900' : 'bg-neutral-200 text-neutral-700'}`}>{on ? 'Connected' : 'Not connected'}</span>
);

export default function SettingsPage() {
  const uk = shippingOptions('UK');
  const gh = [...shippingOptions('GH', 'Greater Accra'), ...shippingOptions('GH', 'Ashanti')];

  return (
    <>
      <PageHeader title="Settings" subtitle="Read-only for now. These values live in code and become editable once the backend exists." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Delivery rates">
          <dl>
            {[...uk.map((o) => ({ o, cur: 'GBP' as const })), ...gh.map((o) => ({ o, cur: 'GHS' as const }))].map(({ o, cur }) => (
              <Row key={o.id} label={o.label}>{formatMoney(o.price, cur)} · {o.detail}</Row>
            ))}
          </dl>
        </Card>
        <Card title="Free delivery">
          <dl>
            <Row label="United Kingdom">Orders over {formatMoney(FREE_SHIPPING_OVER.GBP, 'GBP')}</Row>
            <Row label="Ghana">Orders over {formatMoney(FREE_SHIPPING_OVER.GHS, 'GHS')}</Row>
          </dl>
        </Card>
        <Card title="Payments">
          <dl>
            <Row label="Stripe (UK cards, Apple Pay, Google Pay)"><Pill on={false} /></Row>
            <Row label="Paystack (Ghana Mobile Money and cards)"><Pill on={false} /></Row>
          </dl>
        </Card>
        <Card title="Store">
          <dl>
            <Row label="Currencies">GBP (UK), GHS (Ghana)</Row>
            <Row label="Sign-in and admin users"><Pill on={false} /></Row>
            <Row label="Database (Supabase)"><Pill on={false} /></Row>
          </dl>
        </Card>
      </div>
    </>
  );
}
