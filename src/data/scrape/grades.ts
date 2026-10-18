import { cleanText, qs, qsa } from '../../lib/dom';
import { SEL } from '../selectors';

/** Quantities shown explicitly by Moodle; a lone grade never implies a denominator. */
export interface GradeStat {
  grade: string;
  earned?: number;
  maximum?: number;
  percentage?: number;
  /** Moodle's own grade-column heading in the page language. */
  label?: string;
}

export interface CourseGradeReport {
  course?: GradeStat;
  /** Moodle course-module ids, read from the grade item's activity link. */
  activities: Record<string, GradeStat>;
}

/** One row of the grade overview (`table#overview-grade`, Moodle 4.5 and 5.x share the markup). */
export interface GradeRow extends GradeStat {
  courseId: number;
  /** Link to the course user report. */
  href: string;
  /** Link text with the trailing "(CODE)" removed. */
  name: string;
  code: string;
  /** The grade as Moodle prints it ("-" when none). */
  grade: string;
  graded: boolean;
}

const CODE_TAIL = /\s*\(([A-Z]{3}\d{4})\)\s*$/;
const NUMBER = '(\\d+(?:[.,]\\d+)?)';
const FRACTION = new RegExp(`^${NUMBER}\\s*/\\s*${NUMBER}$`);
const RANGE = new RegExp(`^${NUMBER}\\s*[-–—]\\s*${NUMBER}$`);
const PERCENTAGE = new RegExp(`^${NUMBER}\\s*%$`);
const NUMERIC = new RegExp(`^${NUMBER}$`);
const number = (s: string | undefined): number => Number(s?.replace(',', '.'));

/** Only zero-based numeric ranges can safely become an earned/max points meter. */
export function gradeStatFromText(grade: string, range = '', percentage = ''): GradeStat {
  const out: GradeStat = { grade };
  const text = grade.trim();
  const fraction = FRACTION.exec(text);
  const percent = PERCENTAGE.exec(text);
  const numeric = NUMERIC.exec(text);
  if (!fraction && !percent && !numeric) return out;
  const explicitPercentage = PERCENTAGE.exec(percentage.trim()) ?? percent;
  if (explicitPercentage) {
    const value = number(explicitPercentage[1]);
    if (Number.isFinite(value)) out.percentage = value;
  }
  const bounds = RANGE.exec(range.trim());
  const earned = fraction ? number(fraction[1]) : numeric ? number(numeric[1]) : undefined;
  const maximum = fraction ? number(fraction[2]) : bounds && number(bounds[1]) === 0 ? number(bounds[2]) : undefined;
  if (earned !== undefined && maximum !== undefined && Number.isFinite(earned) && Number.isFinite(maximum) && maximum > 0) {
    out.earned = earned;
    out.maximum = maximum;
    out.percentage ??= (earned / maximum) * 100;
  }
  return out;
}

function linkUrl(a: HTMLAnchorElement, doc: Document): URL | undefined {
  try {
    const base = /^https?:/.test(doc.baseURI) ? doc.baseURI : 'https://moodle.invalid/';
    return new URL(a.getAttribute('href') ?? '', base);
  } catch {
    return undefined;
  }
}

function unavailable(el: Element): boolean {
  return SEL.gradeUnavailable.some((s) => el.matches(s));
}

const gradeText = (el: Element | null): string => el && unavailable(el) ? '' : cleanText(el, [...SEL.srOnly, '.accesshide', ...SEL.gradeUnavailable].join(', '));

/** Standard Moodle user report, fetched as HTML through the signed-in user's own session. */
export function scrapeCourseGrades(doc: Document): CourseGradeReport | undefined {
  const table = qs(doc, SEL.gradeReportTable);
  if (!table) return undefined;
  const out: CourseGradeReport = { activities: {} };
  const label = cleanText(qs(table, SEL.gradeReportLabel)) || undefined;
  for (const tr of qsa<HTMLTableRowElement>(doc, SEL.gradesReportRows)) {
    const item = qs(tr, SEL.gradeItem);
    const gradeCell = qs(tr, SEL.gradeValue);
    const percentageCell = qs(tr, SEL.gradePercentage);
    if (!item || unavailable(tr) || (gradeCell && unavailable(gradeCell))) continue;
    const raw = gradeText(gradeCell) || (!gradeCell ? gradeText(percentageCell) : '');
    if (!raw) continue;
    const stat = gradeStatFromText(raw, gradeText(qs(tr, SEL.gradeRange)), gradeText(percentageCell));
    stat.label = label;
    if (SEL.gradeCourseTotal.some((s) => tr.matches(s)) || qs(tr, SEL.gradeCourseTotal)) out.course = stat;
    const link = qs<HTMLAnchorElement>(item, SEL.gradeActivity);
    const url = link ? linkUrl(link, doc) : undefined;
    const cmid = url && /^\/mod\/[^/]+\/view\.php$/.test(url.pathname) ? Number(url.searchParams.get('id')) : 0;
    if (Number.isSafeInteger(cmid) && cmid > 0) out.activities[String(cmid)] = stat;
  }
  return out;
}

export function scrapeGradeOverview(doc: Document): GradeRow[] {
  const rows: GradeRow[] = [];
  for (const tr of qsa<HTMLTableRowElement>(doc, SEL.gradesOverview)) {
    const a = tr.querySelector<HTMLAnchorElement>('td a[href*="id="]');
    if (!a) continue;
    const id = Number(linkUrl(a, doc)?.searchParams.get('id')) || 0;
    if (!id) continue;
    const text = cleanText(a);
    const code = CODE_TAIL.exec(text)?.[1] ?? '';
    const cells = tr.querySelectorAll('td');
    const grade = cleanText(cells[cells.length - 1]);
    rows.push({
      courseId: id,
      href: a.getAttribute('href') ?? a.href,
      name: text.replace(CODE_TAIL, ''),
      code,
      ...gradeStatFromText(grade || '-'),
      graded: grade !== '' && grade !== '-' && grade !== '–',
    });
  }
  return rows;
}
