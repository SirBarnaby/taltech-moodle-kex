import { SEL } from '../selectors';
import { cleanText } from '../../lib/dom';

export interface UserMenuItem {
  label: string;
  /** Absolute or root-relative href. For logout the href holds a sesskey: it is read at click time, never stored. */
  href: string;
  kind: 'link' | 'logout';
  /** Draw a divider above this item. */
  divider: boolean;
}

/**
 * Items of Moodle's own user menu (#user-action-menu). Submenu toggles (href "#") and carousel
 * navigation links are skipped. Order and dividers follow the DOM.
 */
export function scrapeUserMenu(root: ParentNode): UserMenuItem[] {
  const menu = root.querySelector('#user-action-menu');
  if (!menu) return [];
  const out: UserMenuItem[] = [];
  let divider = false;
  const nodes = menu.querySelectorAll<HTMLElement>('.carousel-item.active > *, #carousel-item-main > *, :scope > a, :scope > .dropdown-divider');
  const seen = new Set<Element>();
  const list = nodes.length ? Array.from(nodes) : Array.from(menu.querySelectorAll<HTMLElement>(SEL.userMenu[0]));
  for (const n of list) {
    if (seen.has(n)) continue;
    seen.add(n);
    if (n.classList.contains('dropdown-divider')) {
      divider = out.length > 0;
      continue;
    }
    if (!n.matches('a.dropdown-item')) continue;
    const href = n.getAttribute('href') ?? '';
    if (!href || href === '#' || href.startsWith('javascript:') || n.classList.contains('carousel-navigation-link')) continue;
    const label = cleanText(n);
    if (!label) continue;
    out.push({ label, href, kind: /\/login\/logout\.php/.test(href) ? 'logout' : 'link', divider });
    divider = false;
  }
  return out;
}

/** The live logout link at click time (it carries the current sesskey). */
export function findLogoutHref(root: ParentNode): string | null {
  return root.querySelector<HTMLAnchorElement>('#user-action-menu a[href*="/login/logout.php"], a[href*="/login/logout.php?sesskey="]')?.getAttribute('href') ?? null;
}
