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
