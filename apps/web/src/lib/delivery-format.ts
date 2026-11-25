import { useEffect, useState } from 'react';

const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const day = (d: Date) => fmt.format(d).replace(',', '');

/** "Wed 3 Dec" or "Wed 3 Dec – Fri 5 Dec". */
export function formatArrival(range: { from: Date; to: Date }): string {
  const a = day(range.from);
  const b = day(range.to);
  return a === b ? a : `${a} – ${b}`;
}

/** The current time, available only after mount so server and browser markup always match. */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}
