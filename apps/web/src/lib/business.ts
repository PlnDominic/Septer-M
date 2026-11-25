/**
 * Who we are and how to reach us. Everything comes from environment variables so real details are
 * never invented in code. Anything not set is simply not shown (see `pnpm check:launch`).
 */
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const BUSINESS = {
  name: 'Septer-M',
  /** Registered company name, if different from the trading name. */
  legalName: clean(process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME),
  companyNumber: clean(process.env.NEXT_PUBLIC_COMPANY_NUMBER),
  /** One line, e.g. "1 Example Street, London, AB1 2CD". */
  address: clean(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS),
  vatNumber: clean(process.env.NEXT_PUBLIC_VAT_NUMBER),
  supportEmail: clean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  /** Digits with country code and no symbols, e.g. 233241234567. */
  whatsapp: clean(process.env.NEXT_PUBLIC_WHATSAPP)?.replace(/\D/g, ''),
  supportHours: clean(process.env.NEXT_PUBLIC_SUPPORT_HOURS),
  instagram: clean(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
  tiktok: clean(process.env.NEXT_PUBLIC_TIKTOK_URL),
} as const;

export const hasContactMethod = Boolean(BUSINESS.supportEmail || BUSINESS.whatsapp);

/** "Septer-M is a trading name of X Ltd (company no. 123), 1 Example St." or undefined if nothing to say. */
export function registeredLine(): string | undefined {
  const parts: string[] = [];
  if (BUSINESS.legalName) parts.push(`${BUSINESS.name} is a trading name of ${BUSINESS.legalName}`);
  if (BUSINESS.companyNumber) parts.push(`company number ${BUSINESS.companyNumber}`);
  if (BUSINESS.vatNumber) parts.push(`VAT number ${BUSINESS.vatNumber}`);
  if (BUSINESS.address) parts.push(BUSINESS.address);
  return parts.length ? parts.join(', ') + '.' : undefined;
}

export const whatsappUrl = (text?: string) =>
  BUSINESS.whatsapp ? `https://wa.me/${BUSINESS.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}` : undefined;
