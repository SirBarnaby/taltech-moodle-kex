import { createElement, render } from 'preact';
import { applyShellAttrs, shellAttrs } from '../lib/theme';
import type { Settings } from '../lib/settings';
import { ErrorBoundary } from '../ui/shell/Shell';
import { GuestHeader } from '../ui/views/GuestHeader';
import { domContentLoaded } from './boot';
import { setMode } from './modes';
import { scrapeGuest } from './skinguestmodel';
import type { EffectiveRoute } from './router';

/**
 * The signed-out skin. A guest has no shell (no sidebar, no data layer), but the public pages (front page, course catalogue, course
 * info, enrol, password reset, sign-up) get the same skin as signed-in pages and a small header of their own: the lockup, Moodle's
 * own primary navigation, its language menu and, above all, the login button. Everything the header says is read from Moodle's own
 * navbar (Moodle 4.x with Bootstrap 4 or 5, TalTech's `.tt-level1` bar, Moodle 5), in the page's language.
 */

/** Content that follows the navbar in Moodle's markup: once one of these exists, the navbar has been parsed. */
const AFTER_NAVBAR = '#page-content, #region-main, [role="main"], #page-footer';

/**
 * Resolves when the navbar is complete. DOMContentLoaded can be seconds away on a slow Moodle page (the controller's failsafe gives up
 * after 3 s), but the navbar is near the top of the markup: the first element after it is enough.
 */
export function navbarParsed(doc: Document): Promise<void> {
  if (doc.readyState !== 'loading' || doc.querySelector(AFTER_NAVBAR)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      mo.disconnect();
      resolve();
    };
    const mo = new MutationObserver(() => doc.querySelector(AFTER_NAVBAR) && done());
    mo.observe(doc.documentElement, { childList: true, subtree: true });
    void domContentLoaded().then(done);
  });
}

export interface GuestSkinOptions {
  html: HTMLElement;
  doc: Document;
  wwwroot: string;
  route: EffectiveRoute;
  settings: Settings;
  /** The controller's failure path (plain Moodle plus the error pill). */
  onError: (e: unknown) => void;
}

/**
 * Turn a signed-out page into a skin page with the guest header. Returns the mount root (the controller unmounts it like the shell),
 * or null when the page should stay plain Moodle (embedded layouts, a route the user turned off).
 */
export async function mountGuestSkin({ html, doc, wwwroot, route, settings, onError }: GuestSkinOptions): Promise<HTMLElement | null> {
  if (route.effective === 'off' || route.key === 'embedded') return null;
  // The navbar's login link and language menu come late in the navbar: read them once it is complete.
  await navbarParsed(doc);
  const body = doc.body;
  if (!body) return null;
  applyShellAttrs(html, shellAttrs(settings, window.innerWidth));
  const model = scrapeGuest(doc, wwwroot);
  const root = doc.createElement('div');
  root.id = 'kex-root';
  root.lang = (doc.documentElement.lang || 'en').slice(0, 2);
  body.insertBefore(root, body.firstChild);
  html.dataset.kexGuest = '1';
  html.dataset.kexShell = 'ready';
  render(createElement(ErrorBoundary, { onError: (e: unknown) => queueMicrotask(() => onError(e)), children: createElement(GuestHeader, { model }) }), root);
  setMode('skin');
  return root;
}

export function unmountGuestSkin(html: HTMLElement): void {
  delete html.dataset.kexGuest;
}
