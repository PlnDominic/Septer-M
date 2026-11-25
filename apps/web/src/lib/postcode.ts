/**
 * Free UK postcode check (postcodes.io, public data, no key). It only catches typos: the shopper is never
 * blocked by it, because brand-new postcodes can be missing and the service can be down.
 */
export type PostcodeCheck = { found: true; area: string } | { found: false } | null;

export async function checkPostcode(postcode: string, signal?: AbortSignal): Promise<PostcodeCheck> {
  const pc = postcode.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc)) return null;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, { signal });
    if (res.status === 404) return { found: false };
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { admin_district?: string | null; region?: string | null; country?: string | null } };
    const r = body.result;
    return { found: true, area: [r?.admin_district, r?.region ?? r?.country].filter(Boolean).join(', ') };
  } catch {
    return null;
  }
}
