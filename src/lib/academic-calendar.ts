/** TalTech's published teaching calendar. Civil dates are evaluated in Tallinn, independent of the browser timezone.
 * Source: https://oigusaktid.taltech.ee/akadeemilise-kalendri-kinnitamine-jargmiseks-oppeaastaks/
 * Updated 2025-12-04. Unknown academic years deliberately have no guessed week number.
 */
import { ACADEMIC_CALENDAR } from '../data/academic-calendar';
import { sourced } from '../data/sources';
export type AcademicPeriod = { kind: 'teaching'; week: number } | { kind: 'exams' | 'winter' | 'summer' | 'preweek' | 'unknown' };
const TERMS = ACADEMIC_CALENDAR.terms;
const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86400000;
export function academicPeriod(nowSec: number): AcademicPeriod {
  if (!Number.isFinite(nowSec)) return { kind: 'unknown' };
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(nowSec * 1000));
  const part = (name: string): string => parts.find((p) => p.type === name)!.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  for (const term of TERMS) {
    if (date < term.start || date > term.end) continue;
    if (date.slice(5) >= '12-24' || date.slice(5) <= '01-01') return { kind: 'winter' };
    if (date > term.teachingEnd) return { kind: 'exams' };
    const week = Math.floor((day(date) - day(term.start)) / 7) + 1;
    return week >= 1 && week <= 16 ? { kind: 'teaching', week } : { kind: 'exams' };
  }
  for (let i = 1; i < TERMS.length; i++) {
    const prev = TERMS[i - 1]!;
    const next = TERMS[i]!;
    if (date <= prev.end || date >= next.start) continue;
    if (next.start.slice(5) < '08-01') return { kind: 'winter' };
    return day(next.start) - day(date) <= 7 ? { kind: 'preweek' } : { kind: 'summer' };
  }
  // The following year's pre-week is published in the 2027/28 admission calendar.
  if (date > '2027-06-13' && date < '2027-08-23') return { kind: 'summer' };
  if (date >= '2027-08-23' && date <= '2027-08-29') return { kind: 'preweek' };
  return { kind: 'unknown' };
}

export function calendarData(nowSec: number) {
  const period = academicPeriod(nowSec);
  const date = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Tallinn' }).format(new Date(nowSec * 1000));
  return {
    ...sourced(period, { domain: 'calendar', kind: 'published', originalPath: ACADEMIC_CALENDAR.sourceUrl, ttlMs: Infinity }, Date.parse(ACADEMIC_CALENDAR.verifiedAt)),
    version: ACADEMIC_CALENDAR.version,
    maintenance: period.kind === 'unknown' ? 'uncovered' : date >= ACADEMIC_CALENDAR.reviewBy ? 'review-due' : 'current',
    reviewBy: ACADEMIC_CALENDAR.reviewBy,
  } as const;
}
