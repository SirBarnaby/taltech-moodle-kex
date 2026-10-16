/**
 * Small, idempotent decorations of Moodle's own markup that CSS alone cannot do (page-designs §7): status pills in the assignment
 * status table. Text-only cells are wrapped in a span; nothing else in Moodle's DOM changes.
 */

type Tone = 'violet' | 'magenta' | 'green' | 'amber' | 'grey';

function toneOf(td: Element, row: number): Tone | undefined {
  const c = td.className;
  if (/submissionstatussubmitted|submissionstatusreopened/.test(c)) return 'violet';
  if (/submissionstatusdraft/.test(c)) return 'amber';
  if (/submissionnotgraded/.test(c)) return 'grey';
  if (/submissiongraded/.test(c)) return 'green';
  if (/\b(overdue|latesubmission)\b/.test(c)) return 'magenta';
  if (row === 0) return 'grey';
  return undefined;
}

export function decorateSkinPage(doc: Document): void {
  decorateBook(doc);
  decorateParticipants(doc);
  decorateCourseBoxes(doc);
  // An activity header that says nothing (no description, dates or completion) would render as an empty card.
  doc.querySelectorAll('[data-region="activity-information"]').forEach((el) => {
    const empty = !el.textContent?.trim() && !el.querySelector('img, button, a');
    if (empty) el.setAttribute('data-kex-empty', '');
    else el.removeAttribute('data-kex-empty');
  });
  const table = doc.querySelector('.submissionstatustable table');
  if (!table) return;
  table.querySelectorAll('tr').forEach((tr, i) => {
    const td = tr.querySelector('td');
    if (!td || td.querySelector('.kex-pill')) return;
    const tone = toneOf(td, i);
    if (!tone) return;
    const text = td.textContent?.trim() ?? '';
    if (!text || td.children.length > 0) return;
    const span = doc.createElement('span');
    span.className = `kex-pill kex-pill--${tone}`;
    span.textContent = text;
    td.textContent = '';
    td.append(span);
  });
}

/** Book: the chapter list lives in the (hidden) blocks drawer; a clone of it becomes the sticky left column of the page. */
export function decorateBook(doc: Document): void {
  const main = doc.querySelector('#region-main');
  const toc = doc.querySelector('.block_book_toc .book_toc');
  if (!main || !toc || !doc.body.classList.contains('path-mod-book')) return;
  const existing = main.querySelector(':scope > .kex-booktoc');
  const fresh = toc.cloneNode(true) as HTMLElement;
  if (existing && existing.innerHTML === fresh.outerHTML) return;
  const nav = existing ?? doc.createElement('nav');
  nav.className = 'kex-booktoc';
  nav.setAttribute('aria-label', doc.querySelector('.block_book_toc .card-title')?.textContent?.trim() || 'Contents');
  nav.innerHTML = fresh.outerHTML;
  if (!existing) main.prepend(nav);
  main.classList.add('kex-bookgrid');
}

const COL_CLASS: Record<string, string> = { roles: 'kex-col-roles', groups: 'kex-col-groups', lastaccess: 'kex-col-access', lastcourseaccess: 'kex-col-access' };

/** Participants table: mark the roles, groups and last-access columns (by Moodle's `data-column`, not by language) and turn roles into pills. */
export function decorateParticipants(doc: Document): void {
  const table = doc.querySelector('table#participants');
  if (!table) return;
  const heads = Array.from(table.querySelectorAll('thead th'));
  heads.forEach((th, i) => {
    const key = th.querySelector('[data-column]')?.getAttribute('data-column') ?? th.querySelector('a[data-sortby]')?.getAttribute('data-sortby') ?? '';
    const cls = COL_CLASS[key];
    if (!cls) return;
    th.classList.add(cls);
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const td = tr.children[i];
      if (!td) return;
      td.classList.add(cls);
      if (cls !== 'kex-col-roles' || td.querySelector('.kex-role')) return;
      const inner = td.querySelectorAll(':scope > a, :scope > .inplaceeditable, :scope > span:not(.visually-hidden):not(.sr-only):not(.accesshide)');
      if (inner.length) {
        inner.forEach((el) => el.classList.add('kex-role'));
        return;
      }
      const text = td.textContent?.trim() ?? '';
      if (!text || td.children.length) return;
      td.textContent = '';
      for (const name of text.split(/\s*,\s*/).filter(Boolean)) {
        const span = doc.createElement('span');
        span.className = 'kex-role';
        span.textContent = name;
        td.append(span);
      }
    });
  });
}

const COURSE_CODE_TAIL = /\s*\(([A-Z]{3}\d{4})\)\s*$/;

/** Catalogue and search results: the trailing "(CODE)" of a course name becomes a mono code in front (page-designs §16). */
export function decorateCourseBoxes(doc: Document): void {
  doc.querySelectorAll('.coursebox .coursename a').forEach((a) => {
    if (a.querySelector('.kex-coursecode')) return;
    const walker = doc.createTreeWalker(a, 4 /* SHOW_TEXT */);
    let last: Text | undefined;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue?.trim()) last = n as Text;
    const m = last ? COURSE_CODE_TAIL.exec(last.nodeValue ?? '') : null;
    if (!last || !m) return;
    last.nodeValue = (last.nodeValue ?? '').replace(COURSE_CODE_TAIL, '');
    const code = doc.createElement('span');
    code.className = 'kex-coursecode';
    code.textContent = m[1] ?? '';
    a.prepend(code);
    // Text nodes of the name are siblings of the highlight spans; a wrapper keeps them on one flex item.
    const wrap = doc.createElement('span');
    wrap.className = 'kex-coursename';
    while (code.nextSibling) wrap.append(code.nextSibling);
    a.append(wrap);
  });
}
