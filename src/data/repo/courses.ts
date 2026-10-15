import { cache, type Store } from '../cache';
import type { Course, Season } from '../model';
import { parseCourseName } from '../names';
import { scrapeMyoverview, type MyoverviewGrouping } from '../scrape/myoverview';
import { ws } from '../ws';
import { log } from '../../lib/log';
import type { Settings } from '../../lib/settings';

const TIMELINE = 'core_course_get_enrolled_courses_by_timeline_classification';
const PREFS = 'core_user_get_user_preferences';

export type Classification = 'all' | 'inprogress' | 'future' | 'past' | 'favourites' | 'hidden' | 'customfield';

export interface RawCourse {
  id: number;
  fullname: string;
  shortname: string;
  idnumber?: string;
  summary?: string;
  startdate?: number;
  enddate?: number;
  viewurl?: string;
  courseimage?: string;
  progress?: number | null;
  hasprogress?: boolean;
  isfavourite?: boolean;
  hidden?: boolean;
  coursecategory?: string;
}

interface TimelineResponse {
  courses: RawCourse[];
  nextoffset?: number;
}

interface PrefsResponse {
  preferences: { name: string; value: string | null }[];
}

export function mapCourse(raw: RawCourse, lang: 'en' | 'et' = 'en', wwwroot = ''): Course {
  const parsed = parseCourseName(raw.shortname ?? '', raw.fullname ?? '', raw.idnumber ?? '', lang);
  const image = raw.courseimage && /^https?:/.test(raw.courseimage) ? raw.courseimage : undefined;
  return {
    id: raw.id,
    code: parsed.code,
    name: parsed.name,
    fullname: raw.fullname,
    shortname: raw.shortname,
    semester: parsed.semester,
    url: raw.viewurl || `${wwwroot}/course/view.php?id=${raw.id}`,
    image,
    progress: raw.hasprogress === false ? null : (raw.progress ?? null),
    favourite: !!raw.isfavourite,
    hidden: !!raw.hidden,
    category: raw.coursecategory || undefined,
    startdate: raw.startdate || undefined,
    enddate: raw.enddate || undefined,
  };
}

/**
 * Short English names shipped for the author's six TalTech courses (iteration3). They are only a default:
 * a user alias (F2 in the sidebar) always wins.
 */
export const DEFAULT_ALIASES_BY_CODE: Readonly<Record<string, string>> = {
  ITI8801: 'Cloud & DevOps',
  EMT0140: 'IoT for Industry',
  IAS0230: 'Embedded Systems',
  MMO5770: 'Management & Leadership',
  ITB8833: 'Digital State ICT',
  IEE2630: 'Smart Networks',
};

/** Default sidebar order for courses that are not in the frozen order yet: the mock's order, then by code. */
export const DEFAULT_ORDER_BY_CODE: readonly string[] = ['ITI8801', 'EMT0140', 'IAS0230', 'MMO5770', 'ITB8833', 'IEE2630'];

/** Frozen order first, then anything new in the default order (mock order for known codes, then by code). */
export function orderCourses<T extends { id: number; code: string }>(courses: readonly T[], order: readonly number[]): T[] {
  const idx = new Map(order.map((id, i) => [id, i]));
  const known = courses.filter((c) => idx.has(c.id)).sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
  const rank = (c: { code: string }): number => {
    const i = DEFAULT_ORDER_BY_CODE.indexOf(c.code);
    return i < 0 ? DEFAULT_ORDER_BY_CODE.length : i;
  };
  const fresh = courses
    .filter((c) => !idx.has(c.id))
    .sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code, 'et'));
  return [...known, ...fresh];
}

/** Courses as the sidebar shows them: the user's alias, else the shipped default alias for the code. */
export function applyAliases(courses: readonly Course[], aliases: Record<string, string>): Course[] {
  return courses.map((c) => {
    const alias = aliases[String(c.id)] || DEFAULT_ALIASES_BY_CODE[c.code];
    return alias ? { ...c, alias } : c;
  });
}

export function displayName(c: Pick<Course, 'name' | 'alias'>): string {
  return c.alias || c.name;
}

/** "COURSES / AUTUMN 2026": the most common semester of the shown courses, else derived from the date. */
export function currentSemester(courses: readonly Course[], now: Date = new Date()): { season: Season; year: number } {
  const counts = new Map<string, { s: { season: Season; year: number }; n: number }>();
  for (const c of courses) {
    if (!c.semester) continue;
    const k = `${c.semester.season}-${c.semester.year}`;
    const cur = counts.get(k);
    if (cur) cur.n++;
    else counts.set(k, { s: c.semester, n: 1 });
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (best) return best.s;
  const m = now.getMonth();
  if (m >= 7) return { season: 'autumn', year: now.getFullYear() };
  if (m === 0) return { season: 'autumn', year: now.getFullYear() - 1 };
  return { season: 'spring', year: now.getFullYear() };
}

const timelineArgs = (classification: Classification, field?: { name: string; value: string }): Record<string, unknown> => ({
  offset: 0,
  limit: 0,
  classification,
  sort: 'fullname',
  customfieldname: field?.name ?? '',
  customfieldvalue: field?.value ?? '',
});

/** What the user's own "My courses" filter is, from its stored preferences. */
export function groupingFromPrefs(prefs: PrefsResponse['preferences']): { grouping: Classification; value?: string } {
  const get = (n: string): string | undefined => prefs.find((p) => p.name === n)?.value ?? undefined;
  // Moodle's own default for a user who never touched the filter is "All".
  const g = get('block_myoverview_user_grouping_preference') ?? 'all';
  if (g === 'customfield') return { grouping: 'customfield', value: get('block_myoverview_user_grouping_customfieldvalue_preference') };
  // "past", "future" and "hidden" make a poor sidebar; mirror only the groupings that do.
  if (g === 'all' || g === 'favourites' || g === 'inprogress') return { grouping: g };
  return { grouping: 'inprogress' };
}

export interface CoursesDeps {
  userId: number;
  wwwroot: string;
  /** Custom field scraped from /my/ or /my/courses.php (cached by the caller). */
  getCustomField: () => Promise<MyoverviewGrouping | null>;
  lang: () => 'en' | 'et';
}

/**
 * Fetch the sidebar course set. Typical case is one POST: the user's grouping preference and the
 * speculative "inprogress" classification travel in the same batch; a second request is only needed when
 * the preference points elsewhere. Anything that fails or comes back empty falls back to "inprogress".
 */
export async function fetchSidebarCourses(source: Settings['sidebarSource'], deps: CoursesDeps): Promise<Course[]> {
  const map = (r: TimelineResponse): Course[] => r.courses.map((c) => mapCourse(c, deps.lang(), deps.wwwroot));
  const inprogressP = ws.call<TimelineResponse>(TIMELINE, timelineArgs('inprogress'));
  let target: { grouping: Classification; value?: string } = { grouping: 'inprogress' };
  if (source === 'moodle') {
    try {
      const prefs = await ws.call<PrefsResponse>(PREFS, { name: '', userid: deps.userId });
      target = groupingFromPrefs(prefs.preferences ?? []);
    } catch (e) {
      log.debug('prefs unavailable, using inprogress', e);
    }
  } else if (source === 'starred') target = { grouping: 'favourites' };
  else if (source === 'all') target = { grouping: 'all' };

  const inprogress = map(await inprogressP);
  if (target.grouping === 'inprogress') return inprogress;
  try {
    let field: { name: string; value: string } | undefined;
    if (target.grouping === 'customfield') {
      const cf = await deps.getCustomField();
      if (!cf?.customfieldname || target.value === undefined) return inprogress;
      field = { name: cf.customfieldname, value: target.value };
    }
    const res = map(await ws.call<TimelineResponse>(TIMELINE, timelineArgs(target.grouping, field)));
    return res.length ? res : inprogress;
  } catch (e) {
    log.debug('grouping fetch failed, using inprogress', e);
    return inprogress;
  }
}

export const COURSES_TTL_MS = 6 * 3600 * 1000;

export function createCoursesStore(deps: CoursesDeps, getSource: () => Settings['sidebarSource']): Store<Course[]> {
  return cache.swr<Course[]>('courses', COURSES_TTL_MS, () => fetchSidebarCourses(getSource(), deps));
}

/** Custom field name is cached for 7 days; it is only visible in the DOM of /my/ and /my/courses.php. */
export async function loadCustomField(
  doc: Document,
  onMyPage: boolean,
  fetchHtml: (path: string) => Promise<string>,
): Promise<MyoverviewGrouping | null> {
  if (onMyPage) {
    const live = scrapeMyoverview(doc);
    if (live?.customfieldname) {
      await cache.write('myoverview', live);
      return live;
    }
  }
  const cached = cache.peek<MyoverviewGrouping>('myoverview');
  if (cached && Date.now() - cached.at < 7 * 86400_000) return cached.data;
  try {
    const html = await fetchHtml('/my/courses.php');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const found = scrapeMyoverview(parsed);
    if (found) {
      await cache.write('myoverview', found);
      return found;
    }
  } catch (e) {
    log.debug('custom field fetch failed', e);
  }
  return null;
}
