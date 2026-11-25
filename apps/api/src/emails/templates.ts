import type { Currency } from '@septer-m/shared';

export interface EmailOrder {
  number: string;
  email: string;
  currency: Currency;
  subtotal: number;
  discount: number;
  discountCode?: string | null;
  shippingLabel: string;
  shippingCost: number;
  total: number;
  address: Record<string, unknown>;
  lines: { name: string; qty: number; unitPrice: number }[];
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const LOCALE: Record<Currency, string> = { GBP: 'en-GB', GHS: 'en-GH' };
export const money = (amount: number, currency: Currency) =>
  new Intl.NumberFormat(LOCALE[currency], { style: 'currency', currency }).format(amount / 100);

/** Escape anything a customer typed before it goes into HTML. */
export const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const BRAND = '#ff5500';

function shell(title: string, body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#000">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#000;padding:20px 24px;color:#fff;font-size:22px;font-weight:bold">Septer<span style="color:${BRAND}">•M</span></td></tr>
<tr><td style="padding:28px 24px"><h1 style="margin:0 0 16px;font-size:22px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;background:#fafafa;color:#555;font-size:12px">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:${BRAND};color:#000;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;display:inline-block">${esc(label)}</a></p>`;

function addressLines(a: Record<string, unknown>): string[] {
  const g = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : '');
  const name = `${g('firstName')} ${g('lastName')}`.trim();
  const lines = 'postcode' in a ? [name, g('line1'), g('line2'), g('city'), g('postcode').toUpperCase(), 'United Kingdom'] : [name, g('area'), g('city'), g('region'), g('digitalAddress').toUpperCase(), 'Ghana'];
  return lines.filter(Boolean);
}

function orderTable(o: EmailOrder): string {
  const row = (l: string, r: string, bold = false) =>
    `<tr><td style="padding:6px 0;${bold ? 'font-weight:bold;border-top:1px solid #ddd' : ''}">${l}</td><td align="right" style="padding:6px 0;${bold ? 'font-weight:bold;border-top:1px solid #ddd' : ''}">${r}</td></tr>`;
  const items = o.lines.map((l) => row(`${esc(l.name)} × ${l.qty}`, esc(money(l.unitPrice * l.qty, o.currency)))).join('');
  const discount = o.discount > 0 ? row(`Discount${o.discountCode ? ` (${esc(o.discountCode)})` : ''}`, `−${esc(money(o.discount, o.currency))}`) : '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">${items}${row('Subtotal', esc(money(o.subtotal, o.currency)))}${discount}${row(esc(o.shippingLabel), o.shippingCost === 0 ? 'Free' : esc(money(o.shippingCost, o.currency)))}${row('Total', esc(money(o.total, o.currency)), true)}</table>`;
}

function orderText(o: EmailOrder): string {
  const lines = o.lines.map((l) => `  ${l.name} x ${l.qty}  ${money(l.unitPrice * l.qty, o.currency)}`);
  return [
    ...lines,
    `  Subtotal  ${money(o.subtotal, o.currency)}`,
    ...(o.discount > 0 ? [`  Discount${o.discountCode ? ` (${o.discountCode})` : ''}  -${money(o.discount, o.currency)}`] : []),
    `  ${o.shippingLabel}  ${o.shippingCost === 0 ? 'Free' : money(o.shippingCost, o.currency)}`,
    `  Total  ${money(o.total, o.currency)}`,
  ].join('\n');
}

export function orderConfirmation(o: EmailOrder, trackUrl: string): Rendered {
  const addr = addressLines(o.address);
  const html = shell(
    `Thank you, your order is confirmed`,
    `<p style="margin:0 0 16px">We've received your payment for order <strong>${esc(o.number)}</strong>.</p>${orderTable(o)}
<h2 style="font-size:16px;margin:24px 0 8px">Delivering to</h2><p style="margin:0;line-height:1.5">${addr.map(esc).join('<br>')}</p>
${button(trackUrl, 'Track your order')}`,
    'Questions? Reply to this email. Patch test before first use and stop if irritation occurs.',
  );
  const text = [`Thank you, your order is confirmed.`, ``, `We've received your payment for order ${o.number}.`, ``, orderText(o), ``, `Delivering to:`, ...addr.map((l) => `  ${l}`), ``, `Track your order: ${trackUrl}`].join('\n');
  return { subject: `Order ${o.number} confirmed`, html, text };
}

export function orderShipped(o: EmailOrder, note: string | undefined, trackUrl: string): Rendered {
  const html = shell(
    `Your order is on its way`,
    `<p style="margin:0 0 16px">Order <strong>${esc(o.number)}</strong> has been dispatched.</p>${note ? `<p style="margin:0 0 16px"><strong>Delivery note:</strong> ${esc(note)}</p>` : ''}${button(trackUrl, 'Track your order')}`,
    'Delivering in Ghana? Please keep your phone on: the rider may call you.',
  );
  const text = [`Your order is on its way.`, ``, `Order ${o.number} has been dispatched.`, ...(note ? [``, `Delivery note: ${note}`] : []), ``, `Track your order: ${trackUrl}`].join('\n');
  return { subject: `Order ${o.number} has shipped`, html, text };
}

export function welcomeOffer(code: string, shopUrl: string, unsubscribeUrl: string): Rendered {
  const html = shell(
    `Welcome! Here's 10% off your first order`,
    `<p style="margin:0 0 16px">Thanks for joining Septer-M. Use this code at checkout:</p>
<p style="margin:0 0 8px;font-size:26px;font-weight:bold;letter-spacing:2px;background:#f5f5f5;display:inline-block;padding:10px 16px;border-radius:8px">${esc(code)}</p>
<p style="margin:12px 0 0;color:#555;font-size:13px">One use, for your first order only.</p>${button(shopUrl, 'Start shopping')}`,
    `You're receiving this because you signed up at Septer-M. <a href="${esc(unsubscribeUrl)}" style="color:#555">Unsubscribe</a>`,
  );
  const text = [`Welcome to Septer-M!`, ``, `Here's 10% off your first order. Use this code at checkout:`, ``, `  ${code}`, ``, `One use, for your first order only.`, ``, `Start shopping: ${shopUrl}`, ``, `Unsubscribe: ${unsubscribeUrl}`].join('\n');
  return { subject: 'Your 10% welcome code', html, text };
}
