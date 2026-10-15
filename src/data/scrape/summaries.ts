import { sanitizeHtml } from '../../lib/sanitize';
import { qsa } from '../../lib/dom';

/** Section summaries from a (non-tiles) course page: `li[data-for=section][data-id] .summarytext`, sanitized. */
export function scrapeSummaries(root: ParentNode, base?: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const li of qsa<HTMLElement>(root, ['li[data-for="section"][data-id]'])) {
    const id = Number(li.getAttribute('data-id'));
    const box = li.querySelector('.summarytext');
    if (!id || !box) continue;
    const html = sanitizeHtml(box.innerHTML, base).trim();
    if (html) out.set(id, html);
  }
  return out;
}
