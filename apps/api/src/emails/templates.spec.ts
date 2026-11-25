import { esc, money, orderConfirmation, orderShipped, welcomeOffer, type EmailOrder } from './templates';

const order: EmailOrder = {
  number: 'SM-1001', email: 'ada@example.com', currency: 'GBP', subtotal: 2800, discount: 280, discountCode: 'WELCOME-AB12CD',
  shippingLabel: 'Standard delivery', shippingCost: 395, total: 2915,
  address: { firstName: 'Ada', lastName: 'Lovelace', line1: '1 High St', city: 'London', postcode: 'sw1a 1aa' },
  lines: [{ name: 'Vitamin C Brightening Serum', qty: 1, unitPrice: 2800 }],
};

describe('email templates', () => {
  it('confirms the order with totals, discount, address and a tracking link', () => {
    const e = orderConfirmation(order, 'https://shop.test/track?order=SM-1001&token=t');
    expect(e.subject).toBe('Order SM-1001 confirmed');
    for (const s of ['SM-1001', '£28.00', '−£2.80', 'WELCOME-AB12CD', '£3.95', '£29.15', 'SW1A 1AA', 'https://shop.test/track?order=SM-1001&amp;token=t']) expect(e.html).toContain(s);
    for (const s of ['Total  £29.15', 'Discount (WELCOME-AB12CD)  -£2.80', 'Track your order: https://shop.test/track?order=SM-1001&token=t']) expect(e.text).toContain(s);
  });
  it('shows free delivery and omits the discount line when there is none', () => {
    const e = orderConfirmation({ ...order, discount: 0, discountCode: null, shippingCost: 0, total: 2800 }, 'https://x.test');
    expect(e.html).toContain('Free');
    expect(e.html).not.toContain('Discount');
  });
  it('escapes everything a customer typed (no HTML injection)', () => {
    const evil = { ...order, lines: [{ name: '<script>alert(1)</script>', qty: 1, unitPrice: 100 }], discountCode: '"><img src=x>', address: { firstName: '<b>Ada</b>', lastName: '&', line1: '', city: "O'Neil", postcode: 'AB1 2CD' } };
    const e = orderConfirmation(evil, 'https://x.test/?a=1&b="2"');
    expect(e.html).not.toContain('<script>');
    expect(e.html).not.toContain('<img src=x>');
    expect(e.html).not.toContain('<b>Ada</b>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).toContain('O&#39;Neil');
    expect(e.html).toContain('href="https://x.test/?a=1&amp;b=&quot;2&quot;"');
  });
  it('formats a Ghana address and cedis', () => {
    const e = orderConfirmation({ ...order, currency: 'GHS', subtotal: 21000, discount: 0, discountCode: null, shippingCost: 3500, total: 24500, address: { firstName: 'Kofi', lastName: 'Mensah', area: 'East Legon', city: 'Accra', region: 'Greater Accra', digitalAddress: 'ga-123-4567' } }, 'https://x.test');
    expect(e.html).toContain('GH₵245.00');
    expect(e.html).toContain('GA-123-4567');
    expect(e.html).toContain('Ghana');
  });
  it('the shipped email carries the note and the link; the note is escaped', () => {
    const e = orderShipped(order, 'Tracking: <TRK123>', 'https://shop.test/track');
    expect(e.subject).toBe('Order SM-1001 has shipped');
    expect(e.html).toContain('Tracking: &lt;TRK123&gt;');
    expect(e.text).toContain('Delivery note: Tracking: <TRK123>');
    expect(orderShipped(order, undefined, 'https://x.test').html).not.toContain('Delivery note');
  });
  it('the welcome email shows the code and an unsubscribe link', () => {
    const e = welcomeOffer('WELCOME-AB12CD', 'https://shop.test', 'https://shop.test/unsubscribe?token=abc');
    expect(e.html).toContain('WELCOME-AB12CD');
    expect(e.html).toContain('Unsubscribe');
    expect(e.text).toContain('Unsubscribe: https://shop.test/unsubscribe?token=abc');
  });
  it('esc and money helpers', () => {
    expect(esc('<&>"\'')).toBe('&lt;&amp;&gt;&quot;&#39;');
    expect(esc(null)).toBe('');
    expect(money(1999, 'GBP')).toBe('£19.99');
    expect(money(24500, 'GHS')).toBe('GH₵245.00');
  });
});
