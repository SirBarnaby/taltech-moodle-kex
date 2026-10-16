import { cleanText } from '../lib/dom';

/** What the signed-out header needs from Moodle's own navbar (pure over a Document; see skinguest.ts). */

export interface GuestLink {
  text: string;
  href: string;
  active: boolean;
}

export interface GuestLang extends GuestLink {
  code: string;
}

export interface GuestModel {
  homeHref: string;
  nav: GuestLink[];
  langs: GuestLang[];
  /** Moodle's own words for the language menu button ("Keel") and for the login link ("Logi sisse"). */
  langLabel: string;
  login?: GuestLink;
}

const LANG_CODE = /[?&]lang=([a-z]{2}(?:_[a-z]+)?)/i;
/** Direction marks Moodle puts around "(et)". */
const BIDI = /[‎‏‪-‮]/g;

const text = (el: Element | null | undefined): string => cleanText(el).replace(BIDI, '').trim();

function abs(doc: Document, href: string | null): string {
  if (!href) return '';
  try {
    return new URL(href, doc.baseURI).href;
  } catch {
    return href;
  }
}

/** Pure over a Document: what the guest header needs from Moodle's navbar. */
export function scrapeGuest(doc: Document, wwwroot: string): GuestModel {
  const home = abs(doc, doc.querySelector('a.navbar-brand')?.getAttribute('href') ?? `${wwwroot}/`) || `${wwwroot}/`;

  const seen = new Set<string>();
  const nav: GuestLink[] = [];
  doc.querySelectorAll<HTMLAnchorElement>('.primary-navigation a.nav-link[href], .primary-navigation [data-region="moredropdown"] a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (!href || href === '#' || a.classList.contains('dropdown-toggle') || a.closest('[data-region="morebutton"] > a')) return;
    const label = text(a);
    const url = abs(doc, href);
    if (!label || seen.has(url)) return;
    seen.add(url);
    nav.push({ text: label, href: url, active: a.classList.contains('active') || a.getAttribute('aria-current') === 'true' });
  });

  const htmlLang = (doc.documentElement.lang || '').slice(0, 2).toLowerCase();
  const langs: GuestLang[] = [];
  doc.querySelectorAll<HTMLAnchorElement>('.langmenu .dropdown-item, #lang-dropdown .dropdown-item, [data-region="langmenu"] .dropdown-item').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    const label = text(a);
    const active = a.getAttribute('aria-current') === 'true' || a.classList.contains('active');
    const code = (LANG_CODE.exec(href)?.[1] ?? /\(([a-z]{2}(?:_[a-z]+)?)\)/i.exec(label)?.[1] ?? (active ? htmlLang : '')).slice(0, 2).toLowerCase();
    if (!code) return;
    langs.push({ code, text: label.replace(/\s*\([a-z_]+\)\s*$/i, ''), href: active || href === '#' ? '' : abs(doc, href), active });
  });

  const loginA = doc.querySelector<HTMLAnchorElement>(
    '.usermenu .login a[href], .logininfo a[href*="login/index.php"], nav a[href*="/login/index.php"], .tt-level1 a[href*="/login/index.php"]',
  );
  return {
    homeHref: home,
    nav,
    langs,
    langLabel: doc.querySelector('.langmenu [aria-label], #lang-menu-toggle')?.getAttribute('aria-label') || '',
    login: loginA ? { text: text(loginA), href: abs(doc, loginA.getAttribute('href')), active: false } : undefined,
  };
}
