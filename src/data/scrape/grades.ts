import { cleanText, qsa } from '../../lib/dom';

/** One row of the grade overview (`table#overview-grade`, Moodle 4.5 and 5.x share the markup). */
export interface GradeRow {
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

export function scrapeGradeOverview(doc: Document): GradeRow[] {
  const rows: GradeRow[] = [];
  for (const tr of qsa<HTMLTableRowElement>(doc, ['#overview-grade tbody tr', 'table.generaltable tbody tr'])) {
    const a = tr.querySelector<HTMLAnchorElement>('td a[href*="id="]');
    if (!a) continue;
    let id = 0;
    try {
      id = Number(new URL(a.href, doc.baseURI || 'http://x/').searchParams.get('id')) || 0;
    } catch {
      /* relative href without base */
    }
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
      grade: grade || '-',
      graded: grade !== '' && grade !== '-' && grade !== '–',
    });
  }
  return rows;
}
