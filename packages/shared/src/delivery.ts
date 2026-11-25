/** Orders placed before this local hour are dispatched the same working day. */
export const DISPATCH_CUTOFF_HOUR = 13;

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) left -= 1;
  }
  return d;
}

/**
 * Earliest and latest expected delivery dates. Day 0 is the dispatch day: today if the order is
 * placed on a working day before the cutoff, otherwise the next working day. Weekends are skipped;
 * public holidays are not accounted for, so the dates are estimates.
 */
export function estimateArrival(now: Date, minDays: number, maxDays: number, cutoffHour = DISPATCH_CUTOFF_HOUR): { from: Date; to: Date } {
  const dispatch = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (isWeekend(dispatch) || now.getHours() >= cutoffHour) {
    do dispatch.setDate(dispatch.getDate() + 1);
    while (isWeekend(dispatch));
  }
  return { from: addWorkingDays(dispatch, minDays), to: addWorkingDays(dispatch, maxDays) };
}
