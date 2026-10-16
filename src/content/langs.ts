import type { MoodleLanguage } from '../state';
import { cleanText } from '../lib/dom';

/**
 * The languages Moodle offers, read from its own language menu (user menu or footer): label as Moodle writes it ("Eesti (et)"),
 * the code, and the link that switches to it. Our shell never invents a language list.
 */
export function scrapeLanguages(root: ParentNode, pageLang: string): MoodleLanguage[] {
  const out: MoodleLanguage[] = [];
  const seen = new Set<string>();
  const cur = pageLang.toLowerCase().split(/[-_]/)[0];
  for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*="lang="][lang], a.dropdown-item[href*="lang="]'))) {
    if (a.closest('#kex-root')) continue;
    const href = a.getAttribute('href') ?? '';
    const code = (a.getAttribute('lang') || /[?&]lang=([\w-]+)/.exec(href)?.[1] || '').trim();
    if (!code || !href || seen.has(code)) continue;
    seen.add(code);
    // Moodle writes "English ‎(en)‎": drop the code and the invisible direction marks.
    const label = cleanText(a).replace(/[‎‏]/g, '').replace(/\s*\([\w-]+\)\s*$/, '').trim() || code;
    const marked = a.matches('[aria-current="true"], [aria-current="page"], .active, [aria-selected="true"]');
    out.push({ code, label, href, current: marked || code.toLowerCase().split(/[-_]/)[0] === cur });
  }
  // Only one language, or none: there is nothing to switch.
  if (out.length < 2) return [];
  if (!out.some((l) => l.current)) return out;
  // Several might match by prefix (en, en_us): keep the first as the current one.
  let seenCurrent = false;
  return out.map((l) => {
    if (!l.current) return l;
    const keep = !seenCurrent;
    seenCurrent = true;
    return { ...l, current: keep };
  });
}
