import type { CmDetails } from '../model';
import { cleanText, qs, qsa } from '../../lib/dom';
import { sanitizeHtml } from '../../lib/sanitize';
import { SEL } from '../selectors';
import { classifyFormat, classifyKind } from '../classify';

export interface ParsedCm {
  id: number;
  name: string;
  /** Plugin name from the `modtype_<x>` class. */
  modname: string;
  details: CmDetails;
}

const ACCESS_HIDE = '.sr-only, .visually-hidden, .accesshide';

/** The `modtype_<x>` class of a cm `li` / activity title. */
export function modnameOf(li: Element): string {
  for (const c of Array.from(li.classList)) {
    if (c.startsWith('modtype_')) return c.slice('modtype_'.length);
  }
  const t = li.querySelector('[class*="modtype_"]');
  const m = /(?:^|\s)modtype_([a-z0-9_]+)/.exec(t?.getAttribute('class') ?? '');
  return m?.[1] ?? '';
}

/** Words an icon alt appends to the module name ("Page icon", "Lehekülg ikoon"). */
const ICON_WORD_RE = /\s+(?:icon|ikoon|ikon)$/i;

/**
 * Moodle's own, localised module name of a rendered activity: the `.accesshide` type text next to the name
 * ("URL", "Fail"), else the module icon's alt (tiles format) without its trailing "icon" word.
 */
export function typeNameOf(li: Element): string | undefined {
  const hidden = li.querySelector('.instancename .accesshide, .instancename .sr-only, .instancename .visually-hidden');
  const fromHidden = (hidden?.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (fromHidden) return fromHidden;
  const alt = (li.querySelector('img.activityicon')?.getAttribute('alt') ?? '').replace(/\s+/g, ' ').trim();
  const fromAlt = alt.replace(ICON_WORD_RE, '').trim();
  return fromAlt || undefined;
}

function datesOf(li: Element): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  const items = qsa<HTMLElement>(li, SEL.cmDates);
  const boxes = items.length ? items : Array.from(li.querySelectorAll<HTMLElement>('[data-region="activity-dates"] > div'));
  for (const it of boxes) {
    const labelEl = it.querySelector('.date-item-label, strong');
    const label = cleanText(labelEl).replace(/:$/, '');
    const clone = it.cloneNode(true) as HTMLElement;
    clone.querySelector('.date-item-label, strong')?.remove();
    const text = cleanText(clone);
    if (label || text) out.push({ label, text });
  }
  return out;
}

/** Parse one rendered `li[data-for="cmitem"]` (from get_module, section.php, or the page itself). */
export function parseCmItem(li: Element): ParsedCm | null {
  const id = Number(li.getAttribute('data-id') ?? /module-(\d+)/.exec(li.id)?.[1]);
  if (!Number.isFinite(id) || id <= 0) return null;
  const nameEl = qs(li, SEL.cmName);
  const name = cleanText(nameEl, ACCESS_HIDE) || (li.querySelector('[data-activityname]')?.getAttribute('data-activityname') ?? '');
  const modname = modnameOf(li);
  const icon = qs<HTMLImageElement>(li, SEL.cmIcon)?.getAttribute('src') ?? '';
  const kind = classifyKind({ modname, name, iconKey: icon });
  const format = classifyFormat({ modname, name, iconKey: icon }, kind);
  const badge = cleanText(qs(li, SEL.cmBadge));
  const manual = qs<HTMLElement>(li, SEL.cmManualDone);
  const toggle = manual?.getAttribute('data-toggletype');
  const autoEl = qs(li, SEL.cmAutoCompletion);
  const descEl = qs<HTMLElement>(li, SEL.cmDescription);
  const availEl = qs(li, SEL.cmAvailability);
  const details: CmDetails = {
    iconKey: icon,
    format,
    typeName: typeNameOf(li),
    badge: badge || undefined,
    dates: datesOf(li),
    descriptionHtml: descEl ? sanitizeHtml(descEl.innerHTML) || undefined : undefined,
    availability: availEl ? cleanText(availEl) || undefined : undefined,
    resourceDetails: cleanText(qs(li, SEL.cmResourceDetails)) || undefined,
    manual: manual ? { done: toggle === 'manual:undo' } : undefined,
    autoText: !manual && autoEl ? cleanText(autoEl) || undefined : undefined,
    at: Date.now(),
  };
  return { id, name, modname, details };
}

/** get_module returns the `li` markup as an HTML string. */
export function parseModuleHtml(html: string): ParsedCm | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const li = qs(doc, SEL.cmItem);
  return li ? parseCmItem(li) : null;
}

/** section.php (and the course page): every cm in the document. */
export function parseCmItems(root: ParentNode): ParsedCm[] {
  const out: ParsedCm[] = [];
  for (const li of qsa(root, SEL.cmItem)) {
    const p = parseCmItem(li);
    if (p) out.push(p);
  }
  return out;
}
