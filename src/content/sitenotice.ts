import { signal } from '@preact/signals';
import { cleanText } from '../lib/dom';
import { sanitizeHtml } from '../lib/sanitize';

/**
 * Site notices: what TalTech or Moodle puts in front of every student (the "Teadlik õppija" course invitation, a maintenance
 * banner, Moodle's own notifications). App mode hides Moodle's page, and whatever sits outside it arrives unstyled, so the
 * notice is read here and shown as a KEX card; the original is hidden. Pure over a Document except `liftOriginals`.
 */

export interface SiteNotice {
  /** Hash of the text: a hidden notice shows again once its text changes. */
  key: string;
  text: string;
  /** Sanitized HTML of the message, images and inline SVG left out (the card shows one small icon). */
  html: string;
  /** The notice's own picture, when it has a raster one. */
  icon?: string;
}

/** Moodle and KEX layers that are not notices. */
const NOT_NOTICE = [
  '#kex-root', '#page-wrapper', '.modal', '.modal-backdrop', '.moodle-dialogue-base', '.toast-wrapper', '.popover', '.tooltip', '[role="tooltip"]',
  '.eupopup-container', '[data-flexitour]', '[id^="yui"]', '[id^="MathJax"]', '[aria-live]:not(.alert)', '.flexitour', '.yui3-panel', '[class*="yui3-"]', '.kex-offpill', '.kex-toasts', '[id^="kex-"]', '[class^="kex-"]',
  'script', 'style', 'link', 'template', 'noscript', 'iframe', 'svg', '#page-footer', '.sr-only', '.visually-hidden',
].join(', ');

/** Inside Moodle's page: the top-of-body slot and alerts above the main content (not form errors or block content). */
const IN_PAGE = [
  '#page-wrapper > .alert', '#page-wrapper > div:not([id]):not([class]) > .alert', '#user-notifications .alert', '#page > .alert',
  '#topofscroll > .alert', '#region-main > .alert', '[role="main"] > .alert', '#page-header ~ .alert', '.site-notice', '[data-region="site-notice"]',
].join(', ');

export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function toNotice(el: Element): SiteNotice | null {
  const text = cleanText(el);
  if (text.length < 20) return null;
  const img = Array.from(el.querySelectorAll('img')).find((i) => i.getAttribute('src') && !/spacer|pix\/i\/|\.gif$/i.test(i.getAttribute('src') ?? ''));
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('img, svg, picture, video, audio, button.close, .close, [data-dismiss], [data-bs-dismiss]').forEach((n) => n.remove());
  const html = sanitizeHtml(clone.innerHTML).trim();
  return { key: hashText(text), text, html: html || text, icon: img?.getAttribute('src') ?? undefined };
}

/** Elements that carry a notice: foreign elements at body level and alerts in Moodle's page slots. */
export function noticeElements(doc: Document, inPage = true): Element[] {
  const out: Element[] = [];
  const body = doc.body;
  if (!body) return out;
  for (const child of Array.from(body.children)) {
    if (child.matches(NOT_NOTICE) || child.hasAttribute('hidden') || child.getAttribute('aria-hidden') === 'true') continue;
    out.push(child);
  }
  if (!inPage) return out;
  for (const el of Array.from(doc.querySelectorAll(IN_PAGE))) {
    if (el.closest('form, .block, .modal, .course-content, [data-region="activity-information"]')) continue;
    if (!out.some((o) => o.contains(el))) out.push(el);
  }
  return out;
}

export function scanNotices(doc: Document, inPage = true): { notice: SiteNotice; el: Element }[] {
  const seen = new Set<string>();
  const out: { notice: SiteNotice; el: Element }[] = [];
  for (const el of noticeElements(doc, inPage)) {
    const notice = toNotice(el);
    if (!notice || seen.has(notice.key)) continue;
    seen.add(notice.key);
    out.push({ notice, el });
  }
  return out.slice(0, 3);
}

/** Hide the originals on the live page; they are shown as cards instead. */
export function liftOriginals(items: readonly { el: Element }[]): void {
  for (const { el } of items) if (el.ownerDocument === document) el.classList.add('kex-lifted');
}

/** Notices found on the live page (including ones TalTech's scripts add after load). */
export const liveNotices = signal<SiteNotice[]>([]);

/**
 * Read the live page now and whenever something is added at body level during the first half minute; each notice found is
 * hidden on the page and listed in `liveNotices`. Alerts inside Moodle's page count only where `inPage` says so (the Workspace
 * and My courses); elsewhere they belong to that page. Returns the function that stops watching.
 */
export function watchLiveNotices(inPage: () => boolean): () => void {
  const run = (): void => {
    const found = scanNotices(document, inPage());
    liftOriginals(found);
    const keys = new Set(liveNotices.peek().map((n) => n.key));
    const fresh = found.map((f) => f.notice).filter((n) => !keys.has(n.key));
    if (fresh.length) liveNotices.value = [...liveNotices.peek(), ...fresh].slice(0, 3);
  };
  run();
  if (typeof MutationObserver === 'undefined' || !document.body) return () => undefined;
  let timer: number | undefined;
  const mo = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 120);
  });
  mo.observe(document.body, { childList: true });
  const stop = window.setTimeout(() => mo.disconnect(), 30_000);
  return () => {
    mo.disconnect();
    window.clearTimeout(timer);
    window.clearTimeout(stop);
  };
}
