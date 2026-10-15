import { formatDate, t } from '../i18n';

/** Relative phrases for deadlines and "opened" stamps. `delta` is seconds from now to the event (negative = past). */
export function relTime(deltaSec: number): string {
  const abs = Math.abs(deltaSec);
  const future = deltaSec > 0;
  let n: number;
  let unit: 'min' | 'hour' | 'day' | 'week';
  if (abs < 90) return t('rel.now');
  if (abs < 3600 * 1.5) {
    n = Math.round(abs / 60);
    unit = 'min';
  } else if (abs < 86400 * 1.5) {
    n = Math.round(abs / 3600);
    unit = 'hour';
  } else if (abs < 86400 * 14) {
    n = Math.round(abs / 86400);
    unit = 'day';
  } else {
    n = Math.round(abs / (86400 * 7));
    unit = 'week';
  }
  const key = `rel.${future ? 'in' : 'ago'}.${unit}` as const;
  return t(key, { n });
}

/** "Thu 15 Oct" (weekday short, day, month short), without commas. */
export const shortDay = (ms: number): string => formatDate(ms, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
/** "17:38", 24 h. */
export const clock = (ms: number): string => formatDate(ms, { hour: '2-digit', minute: '2-digit' });
/** "THU 15 OCT" for hero labels. */
export const heroDay = (ms: number): string => shortDay(ms).toUpperCase();

export const greeting = (hour: number): 'morning' | 'afternoon' | 'evening' => (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');

/** Study week: whole weeks since the earliest start date among the courses that already started, plus one. */
export function studyWeek(startdates: readonly (number | undefined)[], nowSec: number): number | undefined {
  const started = startdates.filter((s): s is number => !!s && s <= nowSec);
  if (!started.length) return undefined;
  return Math.floor((nowSec - Math.min(...started)) / (7 * 86400)) + 1;
}
