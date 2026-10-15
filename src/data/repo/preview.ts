import { sanitizeHtml } from '../../lib/sanitize';
import { ws } from '../ws';

/** What the preview sheet can show for a material (design-spec §7). */
export type PreviewContent =
  | { kind: 'frame'; src: string; download: string; type: string }
  | { kind: 'article'; html: string }
  | { kind: 'link'; href: string; domain: string }
  | { kind: 'none' };

const FRAMEABLE = /^(application\/pdf|image\/|video\/|audio\/|text\/plain)/;

const cache = new Map<number, PreviewContent>();

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
    return href ? { kind: 'link', href, domain: domainOf(href) } : { kind: 'none' };
  }
  if (modname === 'resource') {
    const src = doc.querySelector('iframe#resourceobject')?.getAttribute('src') ?? doc.querySelector('object#resourceobject')?.getAttribute('data') ?? doc.querySelector('.resourceworkaround a')?.getAttribute('href');
    if (src) {
      const abs = new URL(src, base).href;
      return { kind: 'frame', src: abs, download: downloadUrl(abs), type: 'application/pdf' };
    }
  }
  return { kind: 'none' };
}

export async function loadPreview(cmid: number, modname: string, url: string): Promise<PreviewContent> {
  const hit = cache.get(cmid);
  if (hit) return hit;
  let out: PreviewContent = { kind: 'none' };
  if (modname === 'resource') {
    const r = await ws.probe(withParam(url, 'redirect', '1'));
    if (r.html) out = previewFromHtml(modname, r.html, r.url);
    else if (FRAMEABLE.test(r.type)) out = { kind: 'frame', src: r.url, download: downloadUrl(r.url), type: r.type };
  } else if (modname === 'page' || modname === 'url') {
    const r = await ws.probe(url);
    if (r.html) out = previewFromHtml(modname, r.html, r.url);
  }
  cache.set(cmid, out);
  return out;
}

export function clearPreviewCache(): void {
  cache.clear();
}
