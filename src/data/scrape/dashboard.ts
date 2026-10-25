import { sanitizeHtml } from '../../lib/sanitize';

export interface DashboardBlock { title: string; html: string; notice: boolean }
/** Preserve editorial content Moodle supplies, independently of its live calendar/course widgets. */
export function scrapeDashboard(doc: Document, base: string): DashboardBlock[] {
  return [...doc.querySelectorAll<HTMLElement>('[data-block="html"], [data-block="advnotifications"], [data-block="news_items"]')].flatMap((block) => {
    const body = block.querySelector('.content');
    if (!body?.textContent?.trim()) return [];
    const html = sanitizeHtml(body.innerHTML, base);
    return html ? [{ title: block.querySelector('h2, h3, .card-title')?.textContent?.trim() ?? '', html, notice: block.dataset.block === 'advnotifications' }] : [];
  });
}
