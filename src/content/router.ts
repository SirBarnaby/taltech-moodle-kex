import type { RouteMode } from '../lib/settings';

export type RouteKey =
  | 'login' | 'editing' | 'workspace' | 'mycourses' | 'course' | 'section' | 'grades' | 'notifications'
  | 'quiz-focus' | 'activity' | 'grade-user' | 'generic' | 'embedded' | 'none';

export interface Route {
  key: RouteKey;
  /** The mode the architecture table assigns to this route. */
  mode: RouteMode;
  /** `/mod/<name>/` for activity routes. */
  mod?: string;
}

export interface RouteInput {
  /** location.pathname with the Moodle wwwroot sub-path already stripped. */
  path: string;
  bodyId: string;
  bodyClasses: readonly string[];
}

const EMBEDDED_LAYOUTS = ['popup', 'embedded', 'print', 'redirect', 'maintenance', 'frametop'];

/** Strip a Moodle sub-directory install ("/moodle") from the pathname. */
export function stripBase(pathname: string, wwwroot: string): string {
  try {
    const base = new URL(wwwroot).pathname.replace(/\/$/, '');
    if (base && pathname.startsWith(base + '/')) return pathname.slice(base.length);
  } catch {
    /* ignore */
  }
  return pathname;
}

/** First match wins (architecture §6). */
export function resolveRoute({ path, bodyId, bodyClasses }: RouteInput): Route {
  const has = (c: string): boolean => bodyClasses.includes(c);
  if (path === '/login/index.php' || path === '/login/' || bodyId === 'page-login-index') return { key: 'login', mode: 'app' };
  if (has('editing')) return { key: 'editing', mode: 'off' };
  if (bodyClasses.some((c) => c.startsWith('pagelayout-') && EMBEDDED_LAYOUTS.includes(c.slice('pagelayout-'.length)))) {
    return { key: 'embedded', mode: 'off' };
  }
  if (path === '/my/' || path === '/my/index.php') return { key: 'workspace', mode: 'app' };
  if (path === '/my/courses.php') return { key: 'mycourses', mode: 'app' };
  if (path === '/course/view.php') return { key: 'course', mode: 'app' };
  if (path === '/course/section.php') return { key: 'section', mode: 'app' };
  if (path === '/grade/report/overview/index.php') return { key: 'grades', mode: 'app' };
  if (path === '/message/output/popup/notifications.php') return { key: 'notifications', mode: 'app' };
  if (path === '/mod/quiz/attempt.php' || path === '/mod/quiz/summary.php') return { key: 'quiz-focus', mode: 'skin', mod: 'quiz' };
  const mod = /^\/mod\/([^/]+)\//.exec(path)?.[1];
  if (mod) return { key: 'activity', mode: 'skin', mod };
  if (path === '/grade/report/user/index.php' || path === '/course/user.php') return { key: 'grade-user', mode: 'skin' };
  if (bodyId.startsWith('page-')) return { key: 'generic', mode: 'skin' };
  return { key: 'none', mode: 'off' };
}

/** Views that exist in this build. App routes without a view render as skin (Moodle inside our shell). */
export const IMPLEMENTED_VIEWS: ReadonlySet<RouteKey> = new Set<RouteKey>([]);

/** Routes that must stay pure Moodle until their dedicated chrome ships. */
export const PURE_MOODLE_UNTIL_READY: ReadonlySet<RouteKey> = new Set<RouteKey>(['login', 'quiz-focus']);

export interface EffectiveRoute extends Route {
  /** What this build actually does. */
  effective: RouteMode;
}

export function effectiveMode(route: Route, overrides: Record<string, RouteMode>): EffectiveRoute {
  if (PURE_MOODLE_UNTIL_READY.has(route.key)) return { ...route, effective: 'off' };
  let mode = overrides[route.key] ?? route.mode;
  if (mode === 'app' && !IMPLEMENTED_VIEWS.has(route.key)) mode = 'skin';
  return { ...route, effective: mode };
}
