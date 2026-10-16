import { stripSesskey } from '../data/cache';
import { safeLocalStorage } from '../lib/dom';

/**
 * Shell snapshot (round 2, "no blank between pages"): the sidebar and header markup of the last page, kept in the page origin's
 * localStorage. On the next hard load it is painted at document_start, before <body> exists, so the chrome never disappears while
 * Moodle's HTML is still arriving. It carries `id="kex-root"` so the shell's own stylesheet applies to it, is inert, and is removed
 * in the same task in which the real shell mounts (or when KEX decides to stay out of the page).
 */

export const SNAPSHOT_KEY = 'kex.shell';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 120_000;
const MARK = 'data-kex-snapshot';

interface Stored {
  v: 1;
  at: number;
  html: string;
}

/** Serialize the chrome of a mounted shell: the sidebar and the header, without per-page state. Null when there is nothing worth keeping. */
export function buildSnapshot(root: ParentNode): string | null {
  const sidebar = root.querySelector<HTMLElement>('.kex-sidebar');
  const header = root.querySelector<HTMLElement>('.kex-header');
  if (!sidebar || !header) return null;
  const clean = (el: HTMLElement): HTMLElement => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('a[href]').forEach((a) => a.setAttribute('href', stripSesskey(a.getAttribute('href') ?? '')));
    c.querySelectorAll('[autofocus], input, textarea').forEach((n) => n.remove());
    c.removeAttribute('inert');
    return c;
  };
  const h = clean(header);
  // The crumbs and the compact title belong to the page that was open.
  h.querySelectorAll('.kex-crumbs ol').forEach((ol) => ol.replaceChildren());
  h.querySelectorAll('.kex-header__title').forEach((n) => n.replaceChildren());
  h.setAttribute('data-compact', 'false');
  const s = clean(sidebar);
  s.setAttribute('data-open', 'false');
  const html = s.outerHTML + h.outerHTML;
  return html.length > MAX_BYTES ? null : html;
}

export function saveSnapshot(root: ParentNode): void {
  try {
    const html = buildSnapshot(root);
    if (!html) return;
    const v: Stored = { v: 1, at: Date.now(), html };
    safeLocalStorage()?.setItem(SNAPSHOT_KEY, JSON.stringify(v));
  } catch {
    /* quota or private mode: the next load just has no snapshot */
  }
}

export function clearSnapshot(): void {
  try {
    safeLocalStorage()?.removeItem(SNAPSHOT_KEY);
  } catch {
    /* nothing to clear */
  }
}

function readStored(): Stored | null {
  try {
    const raw = safeLocalStorage()?.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Stored;
    if (v.v !== 1 || typeof v.html !== 'string' || Date.now() - v.at > MAX_AGE) return null;
    return v;
  } catch {
    return null;
  }
}

/** Mark the sidebar entry that belongs to the page being loaded (the stored one was highlighted for the previous page). */
export function adjustForLocation(container: ParentNode, loc: { pathname: string; search: string }): void {
  const params = new URLSearchParams(loc.search);
  const here = loc.pathname;
  container.querySelectorAll('[aria-current]').forEach((n) => n.removeAttribute('aria-current'));
  container.querySelectorAll('.kex-sb__course--active').forEach((n) => n.classList.remove('kex-sb__course--active'));
  for (const a of Array.from(container.querySelectorAll<HTMLAnchorElement>('.kex-sb__nav a[href]'))) {
    let p: URL;
    try {
      p = new URL(a.getAttribute('href') ?? '', 'http://x/');
    } catch {
      continue;
    }
    const sameDir = p.pathname === here || (p.pathname.endsWith('/my/') && here === '/my/index.php');
    if (sameDir && !p.hash) a.setAttribute('aria-current', 'page');
  }
  if (here.endsWith('/course/view.php')) {
    const id = params.get('id');
    const course = id ? container.querySelector<HTMLElement>(`.kex-sb__course[data-course-id="${CSS.escape(id)}"]`) : null;
    if (course) {
      course.classList.add('kex-sb__course--active');
      course.setAttribute('aria-current', 'page');
    }
  }
}

/** Paint the stored chrome under <html>. Returns true when something was painted. Never throws. */
export function paintSnapshot(html: HTMLElement, loc: { pathname: string; search: string }): boolean {
  try {
    if (html.querySelector(`[${MARK}]`)) return true;
    const v = readStored();
    if (!v) return false;
    const doc = new DOMParser().parseFromString(v.html, 'text/html');
    if (!doc.body.firstElementChild) return false;
    const host = document.createElement('div');
    host.id = 'kex-root';
    host.setAttribute(MARK, '');
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('inert', '');
    for (const n of Array.from(doc.body.children)) host.appendChild(document.importNode(n, true));
    // Scripts never come from a snapshot: it was serialised from our own markup, and nothing in it may run.
    host.querySelectorAll('script, style, link, iframe, object, embed').forEach((n) => n.remove());
    for (const el of Array.from(host.querySelectorAll('*'))) {
      for (const a of Array.from(el.attributes)) {
        if (/^on/i.test(a.name) || (/^(href|src|xlink:href|action|formaction)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
      }
    }
    adjustForLocation(host, loc);
    html.appendChild(host);
    return true;
  } catch {
    return false;
  }
}

export function hasSnapshot(): boolean {
  return !!document.documentElement?.querySelector(`[${MARK}]`);
}

/** Remove the painted snapshot (the real shell replaces it, or KEX leaves the page alone). */
export function removeSnapshot(): void {
  document.documentElement?.querySelectorAll(`[${MARK}]`).forEach((n) => n.remove());
}
