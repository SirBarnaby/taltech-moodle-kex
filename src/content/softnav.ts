import type { RouteMode } from '../lib/settings';
import { effectiveMode, resolveRoute, stripBase, type EffectiveRoute, type RouteKey } from './router';

/**
 * Soft navigation (round 2): app views open in place. The shell stays painted, the history entry is pushed, the view is swapped.
 * Only app routes qualify: pages Moodle has to run itself (skin routes, activities, forms, editing) stay normal page loads.
 */

/** Views that can be swapped in place. `section` stays a page load (its course is only known from the page). */
export const SOFT_KEYS: ReadonlySet<RouteKey> = new Set<RouteKey>(['workspace', 'mycourses', 'course', 'grades', 'notifications']);

/** Query parameters that turn a course page into something else (editing, notices): never swapped. */
const HARD_PARAMS = ['edit', 'sesskey', 'notifyeditingon', 'notifyeditingoff', 'switchrole', 'action', 'kex'];

/** Default Moodle dashboard links and post-login redirects always arrive at My courses. */
export function homeTarget(url: URL, wwwroot: string): URL {
  const path = stripBase(url.pathname, wwwroot);
  if (url.origin !== new URL(wwwroot).origin || !['/my/', '/my/index.php'].includes(path) || url.hash || url.searchParams.has('course') || url.searchParams.has('kex') || url.searchParams.get('view') === 'dossier') return url;
  const target = new URL(`${wwwroot}/my/courses.php`);
  target.search = url.search;
  return target;
}

export interface SoftTarget {
  key: RouteKey;
  route: EffectiveRoute;
  /** Course id for the course view. */
  courseId?: number;
  /** Path below the Moodle root. */
  path: string;
  /** Views that read data out of the fetched page (grade rows, course tiles and summaries) wait for it before swapping. */
  needsDoc: boolean;
}

/** What the soft navigation would open for `url`, or null when it must be a normal page load. */
export function softTarget(url: URL, ctx: { origin: string; wwwroot: string; routeModes: Record<string, RouteMode> }): SoftTarget | null {
  if (url.origin !== ctx.origin) return null;
  const path = stripBase(url.pathname, ctx.wwwroot);
  const base = resolveRoute({ path, bodyId: '', bodyClasses: [] });
  if (!SOFT_KEYS.has(base.key)) return null;
  for (const p of HARD_PARAMS) if (url.searchParams.has(p)) return null;
  const route = effectiveMode(base, ctx.routeModes);
  if (route.effective !== 'app') return null;
  let courseId: number | undefined;
  if (base.key === 'course') {
    const id = url.searchParams.get('id');
    if (!id || !/^\d+$/.test(id) || url.searchParams.has('section')) return null;
    courseId = Number(id);
  }
  return { key: base.key, route, courseId, path, needsDoc: base.key === 'course' || base.key === 'grades' };
}

/** A plain left click on a link that would open in this tab. */
export function isPlainClick(e: Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'>): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}

/** The anchor behind a click, unless it opts out (new tab, download, another handler owns it). */
export function clickedLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const a = target.closest<HTMLAnchorElement>('a[href]');
  if (!a) return null;
  if (a.hasAttribute('download') || a.hasAttribute('data-kex-hard')) return null;
  const t = a.getAttribute('target');
  if (t && t !== '_self') return null;
  const href = a.getAttribute('href') ?? '';
  if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return null;
  return a;
}

/** Pages that are safe to warm with <link rel=prefetch>: reading them records nothing (no activity "viewed" events). */
const PREFETCH_SAFE = /^\/(my\/|calendar\/view\.php|user\/(preferences|profile|files)\.php|message\/index\.php|grade\/report\/overview\/)/;

export function prefetchSafe(url: URL, ctx: { origin: string; wwwroot: string }): boolean {
  if (url.origin !== ctx.origin || url.searchParams.has('sesskey')) return false;
  return PREFETCH_SAFE.test(stripBase(url.pathname, ctx.wwwroot));
}

/**
 * Fetches pages for soft navigation and hover warm-up. A page fetched on hover is reused by the click that follows
 * (20 s), so the swap is usually instant.
 */
export class PageLoader {
  private cache = new Map<string, { at: number; p: Promise<Document>; controller: AbortController; readers: number; warm: boolean; ready: boolean }>();

  constructor(
    private readonly fetchText: (url: string, signal?: AbortSignal) => Promise<string>,
    private readonly ttl = 20_000,
    private readonly now: () => number = Date.now,
  ) {}

  private key(url: URL): string {
    return url.origin + url.pathname + url.search;
  }

  /** The parsed page (never run, never attached). Rejects when the request fails. */
  load(url: URL, signal?: AbortSignal): Promise<Document> {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const k = this.key(url);
    let entry = this.cache.get(k);
    if (!entry || this.now() - entry.at >= this.ttl || entry.controller.signal.aborted) {
      const controller = new AbortController();
      const p = this.fetchText(url.href, controller.signal).then((html) => new DOMParser().parseFromString(html, 'text/html'));
      entry = { at: this.now(), p, controller, readers: 0, warm: !signal, ready: false };
      this.cache.set(k, entry);
      const created = entry;
      void p.then(() => { created.ready = true; }, () => { if (this.cache.get(k) === created) this.cache.delete(k); });
    }
    if (this.cache.size > 12) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    const hit = entry;
    if (!signal) { hit.warm = true; return hit.p; }
    hit.readers++;
    return new Promise<Document>((resolve, reject) => {
      const release = (): void => { signal.removeEventListener('abort', abort); hit.readers--; };
      const abort = (): void => {
        release();
        if (!hit.ready && !hit.readers && !hit.warm) {
          hit.controller.abort();
          if (this.cache.get(k) === hit) this.cache.delete(k);
        }
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', abort, { once: true });
      void hit.p.then((doc) => { if (!signal.aborted) { release(); resolve(doc); } }, (error: unknown) => { if (!signal.aborted) { release(); reject(error); } });
    });
  }

  /** Drop what is cached (a page that changes server-side after an action must be read fresh). */
  clear(): void {
    this.cache.forEach((entry) => entry.controller.abort());
    this.cache.clear();
  }
}

/** The route a fetched page really is (body id and classes decide: editing mode and embedded layouts are not app views). */
export function routeOfDoc(doc: Document, path: string, routeModes: Record<string, RouteMode>): EffectiveRoute {
  const body = doc.body;
  return effectiveMode(resolveRoute({ path, bodyId: body?.id ?? '', bodyClasses: Array.from(body?.classList ?? []) }), routeModes);
}
