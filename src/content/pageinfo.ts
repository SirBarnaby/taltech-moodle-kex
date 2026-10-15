import { SEL } from '../data/selectors';
import { cleanText, qs } from '../lib/dom';

export interface Crumb {
  text: string;
  href: string | null;
}

/** The subset of M.cfg we use. Moodle's real object has many more fields. */
export interface MoodleCfg {
  wwwroot: string;
  sesskey: string;
  userId: number;
  courseId: number;
  contextid?: number;
  language?: string;
}

export interface PageInfo {
  wwwroot: string;
  /** Kept in memory only. Never written to storage or logs. */
  sesskey: string;
  userId: number;
  courseId: number;
  cmId: number | null;
  contextId: number | null;
  pageLayout: string;
  format: string;
  lang: string;
  bodyId: string;
  breadcrumb: Crumb[];
  heading: string;
  kicker: string;
  isGuest: boolean;
}

/** Find the object literal that follows `M.cfg = ` and parse it (string-aware brace matching). */
export function parseCfgFromText(text: string): Record<string, unknown> | null {
  const start = text.search(/M\.cfg\s*=\s*\{/);
  if (start < 0) return null;
  const open = text.indexOf('{', start);
  let depth = 0;
  let inStr = false;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(text.slice(open, i + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** M.cfg from the page's own JS context (Firefox `wrappedJSObject`, or the main world in tests), then from script text. */
export function readCfg(doc: Document): Record<string, unknown> | null {
  const win = (doc.defaultView ?? window) as Window & { wrappedJSObject?: { M?: { cfg?: unknown } }; M?: { cfg?: unknown } };
  try {
    const live = (win.wrappedJSObject?.M?.cfg ?? win.M?.cfg) as Record<string, unknown> | undefined;
    if (live && typeof live === 'object' && live.sesskey !== undefined) {
      // Copy primitives out of the Xray wrapper so the rest of the code deals with plain data.
      const copy: Record<string, unknown> = {};
      for (const k of ['wwwroot', 'sesskey', 'userId', 'courseId', 'contextid', 'language', 'theme']) copy[k] = live[k];
      return copy;
    }
  } catch {
    /* fall through to the script text */
  }
  for (const s of Array.from(doc.scripts)) {
    const t = s.textContent ?? '';
    if (!t.includes('M.cfg')) continue;
    const cfg = parseCfgFromText(t);
    if (cfg) return cfg;
  }
  return null;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : 0);

export function parseBreadcrumb(root: ParentNode): Crumb[] {
  const items = Array.from(root.querySelectorAll(SEL.breadcrumb[0]));
  return items
    .map((li) => {
      const a = li.querySelector('a[href]');
      return { text: cleanText(li), href: a ? a.getAttribute('href') : null };
    })
    .filter((c) => c.text);
}

export interface PageInfoSource {
  doc: Document;
  pathname: string;
  search: string;
}

/**
 * Page context. Computed once at body detection (cfg, body classes) and refreshed on DOMContentLoaded
 * (breadcrumb, heading). The sesskey stays in memory only.
 */
export function parsePageInfo(src: PageInfoSource): PageInfo {
  const { doc, pathname, search } = src;
  const cfg = readCfg(doc) ?? {};
  const body = doc.body;
  const cls = body?.className ?? '';
  const bodyId = body?.id ?? '';
  const cm = (re: RegExp): string | undefined => re.exec(cls)?.[1];

  let sesskey = typeof cfg.sesskey === 'string' ? cfg.sesskey : '';
  if (!sesskey) {
    const link = doc.querySelector('a[href*="/login/logout.php?sesskey="]')?.getAttribute('href') ?? '';
    sesskey = /sesskey=([A-Za-z0-9]+)/.exec(link)?.[1] ?? doc.querySelector<HTMLInputElement>('input[name="sesskey"]')?.value ?? '';
  }

  let userId = num(cfg.userId);
  if (!userId) {
    const el = doc.querySelector<HTMLElement>('[data-region="popover-region"][data-userid], [data-userid]');
    userId = num(el?.dataset.userid);
  }

  let courseId = num(cfg.courseId);
  if (!courseId) courseId = num(cm(/\bcourse-(\d+)\b/));

  let cmId: number | null = num(cm(/\bcmid-(\d+)\b/)) || null;
  if (!cmId && /^\/mod\/[^/]+\/view\.php$/.test(pathname)) cmId = num(new URLSearchParams(search).get('id')) || null;

  const heading = cleanText(qs(doc, ['.page-header-headings h1', '#page-header h1', 'h1']));
  const kickerEl = doc.querySelector('.page-header-headings .text-uppercase');

  return {
    wwwroot: typeof cfg.wwwroot === 'string' ? cfg.wwwroot.replace(/\/$/, '') : '',
    sesskey,
    userId,
    courseId,
    cmId,
    contextId: num(cfg.contextid) || num(cm(/\bcontext-(\d+)\b/)) || null,
    pageLayout: cm(/\bpagelayout-([\w-]+)/) ?? '',
    format: cm(/\bformat-([\w-]+)/) ?? '',
    lang: cm(/\blang-([\w-]+)/) ?? doc.documentElement.lang ?? '',
    bodyId,
    breadcrumb: parseBreadcrumb(doc),
    heading,
    kicker: cleanText(kickerEl),
    // Logged-out users and the guest account have userId <= 1 (Moodle reports 1 for guests).
    isGuest: userId <= 1,
  };
}
