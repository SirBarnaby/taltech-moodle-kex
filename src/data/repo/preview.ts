import { sanitizeHtml } from '../../lib/sanitize';
import { ws } from '../ws';
import type { RowModel } from '../topics';

/** What the preview sheet can show for a material (design-spec §7). */
export type PreviewContent =
  | { kind: 'frame'; src: string; download: string; type: string }
  | { kind: 'article'; html: string }
  | { kind: 'link'; href: string; domain: string }
  | { kind: 'none' };

const FRAMEABLE = /^(application\/pdf|image\/|video\/|audio\/|text\/plain)/;

const cache = new Map<number, PreviewContent>();

/** Reading stays in context; activities that submit work keep Moodle's own page. */
export const isReadableMaterial = (row: RowModel): boolean => !row.locked && row.kind !== 'note' && ['resource', 'page', 'url'].includes(row.cm.modname);

function linkContent(href: string, base: string): PreviewContent {
  try {
    const u = new URL(href, base);
    return /^https?:$/.test(u.protocol) ? { kind: 'link', href: u.href, domain: domainOf(u.href) } : { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}

function frameContent(src: string, base: string, type: string): PreviewContent {
  const link = linkContent(src, base);
  if (link.kind !== 'link' || new URL(link.href).origin !== new URL(base).origin) return link;
  const inline = new URL(link.href);
  if (inline.searchParams.has('forcedownload')) inline.searchParams.set('forcedownload', '0');
  return { kind: 'frame', src: inline.href, download: downloadUrl(link.href), type };
}

const withParam = (url: string, k: string, v: string): string => {
  const u = new URL(url, location.href);
  u.searchParams.set(k, v);
  return u.href;
};

export const downloadUrl = (fileUrl: string): string => withParam(fileUrl, 'forcedownload', '1');

export function domainOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

/** Pure part: classify a fetched page (unit-tested with captured HTML). */
export function previewFromHtml(modname: string, html: string, base: string): PreviewContent {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (modname === 'page') {
    const body = doc.querySelector('#region-main .box.generalbox, #region-main .generalbox, [role="main"] .no-overflow, [role="main"]');
    const clean = body ? sanitizeHtml(body.innerHTML, base) : '';
    return clean.trim() ? { kind: 'article', html: clean } : { kind: 'none' };
  }
  if (modname === 'url') {
    const href = doc.querySelector<HTMLAnchorElement>('.urlworkaround a, #urlobject, .url-workaround a')?.getAttribute('href');
    return href ? linkContent(href, base) : { kind: 'none' };
  }
  if (modname === 'resource') {
    const src = doc.querySelector('iframe#resourceobject')?.getAttribute('src') ?? doc.querySelector('object#resourceobject')?.getAttribute('data') ?? doc.querySelector('.resourceworkaround a')?.getAttribute('href');
    if (src) {
      return frameContent(src, base, 'application/pdf');
    }
  }
  return { kind: 'none' };
}

export async function loadPreview(cmid: number, modname: string, url: string, signal?: AbortSignal): Promise<PreviewContent> {
  signal?.throwIfAborted();
  const hit = cache.get(cmid);
  if (hit) return hit;
  const original = linkContent(url, location.href);
  if (original.kind !== 'link') return { kind: 'none' };
  if (new URL(original.href).origin !== location.origin) return original;
  let out: PreviewContent = { kind: 'none' };
  if (modname === 'resource') {
    const r = await ws.probe(withParam(original.href, 'redirect', '1'), signal);
    if (new URL(r.url).origin !== location.origin) out = linkContent(r.url, url);
    else if (r.html) out = previewFromHtml(modname, r.html, r.url);
    else if (FRAMEABLE.test(r.type)) out = frameContent(r.url, original.href, r.type);
  } else if (modname === 'page' || modname === 'url') {
    const r = await ws.probe(original.href, signal);
    if (new URL(r.url).origin !== location.origin) out = linkContent(r.url, url);
    else if (r.html) out = previewFromHtml(modname, r.html, r.url);
  }
  signal?.throwIfAborted();
  cache.set(cmid, out);
  return out;
}

export function clearPreviewCache(): void {
  cache.clear();
}
