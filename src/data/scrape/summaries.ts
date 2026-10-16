import { sanitizeHtml } from '../../lib/sanitize';
import { qsa } from '../../lib/dom';

const SECTION = ['li[data-for="section"][data-id]'];

/** The `.summarytext` that belongs to `li` itself, not to a subsection nested inside it. */
function ownSummary(li: Element): Element | null {
  for (const box of Array.from(li.querySelectorAll('.summarytext'))) {
    if (box.closest('li[data-for="section"]') === li) return box;
  }
  return null;
}

/** Sanitized summary HTML of a section element (images and links kept), or ''. */
export function summaryOf(li: Element, base?: string): string {
  const box = ownSummary(li);
  return box ? sanitizeHtml(box.innerHTML, base).trim() : '';
}

/**
 * Section summaries from a course page: `li[data-for=section][data-id] .summarytext`, sanitized, by section id.
 * Delegated sections (subsections rendered inside their parent) are included under their own id.
 */
export function scrapeSummaries(root: ParentNode, base?: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const li of qsa<HTMLElement>(root, SECTION)) {
    const id = Number(li.getAttribute('data-id'));
    if (!id) continue;
    const html = summaryOf(li, base);
    if (html) out.set(id, html);
  }
  return out;
}
