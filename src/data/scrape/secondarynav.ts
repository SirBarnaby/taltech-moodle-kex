import { SEL } from '../selectors';
import { qsa } from '../../lib/dom';

/** One entry of the course's own secondary navigation (Course, Participants, Grades, Competencies, …). */
export interface NavTab {
  /** Moodle's `data-key` ("coursehome", "participants", "grades", "competencies", …). */
  key: string;
  /** Moodle's own label, in the page language. */
  label: string;
  /** Absolute URL. */
  url: string;
  active: boolean;
}

const HIDDEN = '.sr-only, .visually-hidden, .accesshide';

function labelOf(a: Element): string {
  const clone = a.cloneNode(true) as Element;
  clone.querySelectorAll(HIDDEN).forEach((n) => n.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

interface ReactItem {
  key?: string;
  text?: string;
  href?: string;
  active?: boolean;
}

/** Moodle 5 renders the navigation with React and keeps the items in a `data-react-props` attribute. */
function fromReactProps(root: ParentNode, origin: string): NavTab[] {
  const out: NavTab[] = [];
  for (const el of Array.from(root.querySelectorAll('.secondary-navigation [data-react-props]'))) {
    try {
      const items = (JSON.parse(el.getAttribute('data-react-props') ?? '{}') as { items?: ReactItem[] }).items ?? [];
      for (const it of items) {
        const label = (it.text ?? '').replace(/\s+/g, ' ').trim();
        if (!it.key || !label || !it.href || it.href === '#') continue;
        out.push({ key: it.key, label, url: new URL(it.href, origin).href, active: !!it.active });
      }
    } catch {
      /* not our props */
    }
    if (out.length) break;
  }
  return out;
}

/**
 * The course secondary navigation from Moodle's DOM, in order. Entries that Moodle's responsive "More" menu has
 * moved into its dropdown are included too; the dropdown toggle itself (no `data-key`) is not.
 */
export function scrapeSecondaryNav(root: ParentNode, base?: string): NavTab[] {
  const origin = base ?? (typeof location === 'undefined' ? 'http://localhost/' : location.href);
  const out: NavTab[] = [];
  const seen = new Set<string>();
  for (const li of qsa<HTMLElement>(root, SEL.secondaryNav)) {
    const key = li.getAttribute('data-key') ?? '';
    // Submenu entries (e.g. a participant under Participants) are not tabs of their own.
    if (!key || seen.has(key) || li.parentElement?.closest('li[data-key]')) continue;
    const a = Array.from(li.children).find((c): c is HTMLAnchorElement => c.tagName === 'A');
    const href = a?.getAttribute('href') ?? '';
    if (!a || !href || href === '#' || /^javascript:/i.test(href)) continue;
    const label = labelOf(a);
    if (!label) continue;
    let url: string;
    try {
      url = new URL(href, origin).href;
    } catch {
      continue;
    }
    seen.add(key);
    out.push({ key, label, url, active: a.classList.contains('active') || a.getAttribute('aria-current') === 'true' });
  }
  return out.length ? out : fromReactProps(root, origin);
}
