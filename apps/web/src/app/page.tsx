import { REGION_CURRENCY } from '@septer-m/shared';

export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: 'system-ui' }}>
      <h1>Septer-M</h1>
      <p>Storefront coming soon. Currencies: {Object.values(REGION_CURRENCY).join(', ')}</p>
    </main>
  );
}
