import { SEL } from '../data/selectors';
import { cleanText, qs, qsa } from '../lib/dom';

/**
 * What the PageChrome / ActivityChrome band needs from Moodle's own page (page-designs §0, §7). Read from the live DOM after
 * DOMContentLoaded and again when Moodle's JS changes the page (completion toggles, form errors). Pure over a Document.
 */

export interface SkinPage {
  title: string;
  /** Moodle's module kicker ("Forum", "File"): the text above the h1. */
  kicker: string;
  /** Date lines of the activity ("Opened: Mon 5 Oct, 09:00", "Due: Thu 15 Oct, 17:38"). */
  dates: string[];
  /** Manual completion button state, when the activity has one. */
  manual?: { done: boolean };
  /** Automatic completion text ("Done: View", "To do: Submit"), when there is one. */
  auto?: string;
  /** Direct file URL of a resource (`.resourceworkaround a`, `object[data]`, `iframe#resourceobject`). */
  fileUrl?: string;
  /** File name and "PDF · 31 bytes" details of a resource page, and whether Moodle already embeds the file itself. */
  file?: { name: string; details: string; embedded: boolean };
  /** Target of a url module's "Click on ... to open the resource" page. */
  urlTarget?: string;
  /** A Moodle error page (`.errorbox`, `#notice`, maintenance). */
  error?: { code: string; message: string };
}

const DATE_SEL = ['[data-region="activity-dates"] > div', '[data-region="activity-dates"] .date-item', '.activity-dates > div'] as const;
const FILE_SEL = ['.resourceworkaround a[href]', 'object#resourceobject[data]', 'iframe#resourceobject[src]', '.resourcecontent object[data]', '.resourcecontent iframe[src]'] as const;

const MONTH_DAY = /^(?:(?<label>[^:]+):\s*)?(?<wd>[^\s,]+),\s*(?<d>\d{1,2})\.?\s+(?<m>[^\s,\d]+)\s+\d{4},\s*(?<h>\d{1,2}):(?<min>\d{2})(?:\s*(?<ap>[AaPp][Mm]))?$/;

/**
 * "Due: Thursday, 10 September 2026, 5:38 PM" -> "Due Thu 10 Sep, 17:38". Moodle's long date in English or Estonian
 * ("Tähtaeg: neljapäev, 10. september 2026, 17:38"); anything that does not match is returned unchanged.
 */
export function shortDate(text: string): string {
  const m = MONTH_DAY.exec(text.trim());
  const g = m?.groups;
  if (!g) return text;
  let h = Number(g.h);
  if (g.ap) h = (h % 12) + (/p/i.test(g.ap) ? 12 : 0);
  const time = `${String(h).padStart(2, '0')}:${g.min}`;
  const head = g.label ? `${g.label} ` : '';
  return `${head}${(g.wd ?? '').slice(0, 3)} ${g.d} ${(g.m ?? '').slice(0, 3)}, ${time}`;
}

export function parseTitle(doc: Document): string {
  const h = qs(doc, ['.page-header-headings h1', '#page-header h1', '#region-main h1', 'h1']);
  return cleanText(h) || cleanText(doc.querySelector('title')).replace(/\s*[|:].*$/, '');
}

export function parseManual(doc: Document): { done: boolean } | undefined {
  const btn = qs<HTMLElement>(doc, SEL.cmManualDone);
  if (!btn) return undefined;
  const type = btn.getAttribute('data-toggletype') ?? '';
  const done = /undo|mark-undone/.test(type) || btn.classList.contains('btn-success') || btn.getAttribute('aria-pressed') === 'true';
  return { done };
}

export function parseError(doc: Document): { code: string; message: string } | undefined {
  const body = doc.body;
  const box = doc.querySelector('.errorbox, #notice, .box.errorbox, [data-rel="fatalerror"]');
  const maintenance = body?.classList.contains('pagelayout-maintenance');
  if (!box && !maintenance) return undefined;
  const message = cleanText(box?.querySelector('.alert-danger, p, .errormessage') ?? box) || cleanText(doc.querySelector('#region-main h1, h1'));
  const code = cleanText(box?.querySelector('.errorcode, .moreinfo, [data-errorcode]')) || (maintenance ? 'MAINTENANCE' : 'ERROR');
  return { code: code.slice(0, 48), message };
}

export function parseSkinPage(doc: Document): SkinPage {
  const dates = Array.from(new Set(qsa(doc, DATE_SEL).map((el) => cleanText(el)).filter(Boolean)));
  const file = qs<HTMLElement>(doc, FILE_SEL);
  const fileUrl = file?.getAttribute('href') ?? file?.getAttribute('data') ?? file?.getAttribute('src') ?? undefined;
  const autoEl = qs(doc, SEL.cmAutoCompletion);
  return {
    title: parseTitle(doc),
    kicker: cleanText(doc.querySelector('.page-header-headings .text-uppercase')),
    dates: dates.slice(0, 3).map(shortDate),
    manual: parseManual(doc),
    auto: autoEl ? cleanText(autoEl) || undefined : undefined,
    fileUrl,
    file: fileUrl || doc.querySelector('.resourceworkaround')
      ? {
          name: cleanText(doc.querySelector('.resourceworkaround a')) || cleanText(doc.querySelector('.resourcecontent .resourcetitle')),
          details: cleanText(doc.querySelector('.resourcedetails')),
          embedded: !!doc.querySelector('object#resourceobject, iframe#resourceobject, .resourcecontent object, .resourcecontent iframe'),
        }
      : undefined,
    urlTarget: doc.querySelector<HTMLAnchorElement>('.urlworkaround a[href]')?.href ?? undefined,
    error: parseError(doc),
  };
}
