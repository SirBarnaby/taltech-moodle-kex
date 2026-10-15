import { signal } from '@preact/signals';
import { cache, type Store } from '../cache';
import type { Course } from '../model';
import { ws } from '../ws';
import { mapCourse, type Classification, type RawCourse } from './courses';

/** "My courses" (/my/courses.php): one timeline classification per tab, favourites, hidden, last access (page-designs §4). */

export type CoursesTab = 'current' | 'starred' | 'upcoming' | 'past' | 'archived' | 'hidden' | 'all';

export const COURSE_TABS: readonly CoursesTab[] = ['current', 'starred', 'upcoming', 'past', 'archived', 'hidden', 'all'];

const TIMELINE = 'core_course_get_enrolled_courses_by_timeline_classification';

export const CLASSIFICATION: Record<Exclude<CoursesTab, 'current' | 'archived'>, Classification> = {
  starred: 'favourites',
  upcoming: 'future',
  past: 'past',
  hidden: 'hidden',
  all: 'all',
};

interface Timeline {
  courses: RawCourse[];
}

const stores = new Map<string, Store<Course[]>>();

export interface CoursesCtx {
  wwwroot: string;
  lang: () => 'en' | 'et';
  /** Custom field of the archived filter (TalTech `is_archived`), when the site has one. */
  customField: () => { name: string; value: string } | undefined;
  /** What the user's own grouping shows for "Current". */
  inprogress: () => Promise<Course[]>;
}

/** The store of a tab (5 min TTL). Tab data is fetched only when the tab is opened. */
export function tabStore(tab: CoursesTab, ctx: CoursesCtx): Store<Course[]> {
  let s = stores.get(tab);
  if (!s) {
    s = cache.swr<Course[]>(`mycourses:${tab}`, 5 * 60 * 1000, async () => {
      if (tab === 'current') return ctx.inprogress();
      let classification: Classification;
      let field: { name: string; value: string } | undefined;
      if (tab === 'archived') {
        field = ctx.customField();
        if (!field) return [];
        classification = 'customfield';
      } else {
        classification = CLASSIFICATION[tab];
      }
      const res = await ws.call<Timeline>(TIMELINE, {
        offset: 0, limit: 0, classification, sort: 'fullname',
        customfieldname: field?.name ?? '', customfieldvalue: field?.value ?? '',
      });
      return res.courses.map((c) => mapCourse(c, ctx.lang(), ctx.wwwroot));
    });
    stores.set(tab, s);
  }
  return s;
}

export function dropTabStores(): void {
  stores.clear();
}

// ------------------------------------------------------------------ last access

export const lastAccess = signal<ReadonlyMap<number, number>>(new Map());

interface RecentCourse {
  id: number;
  timeaccess?: number;
}

export async function loadLastAccess(userId: number): Promise<void> {
  try {
    const rows = await ws.call<RecentCourse[]>('core_course_get_recent_courses', { userid: userId, limit: 0 });
    lastAccess.value = new Map(rows.filter((r) => r.timeaccess).map((r) => [r.id, r.timeaccess as number]));
  } catch {
    /* optional */
  }
}

// ------------------------------------------------------------------ mutations

/** Star or unstar on the server. Resolves when Moodle confirmed. */
export async function setFavourite(courseId: number, favourite: boolean): Promise<void> {
  await ws.call('core_course_set_favourite_courses', { courses: [{ id: courseId, favourite }] });
}

/** Hide or show a course in "My courses" (Moodle stores it as a user preference). */
export async function setHidden(courseId: number, userId: number, hidden: boolean): Promise<void> {
  void userId;
  await ws.call('core_user_update_user_preferences', {
    preferences: [{ type: `block_myoverview_hidden_course_${courseId}`, value: hidden ? true : null }],
  });
}

/** Tab stores and the sidebar list are stale after a star or hide change. */
export function invalidateCourseLists(): void {
  for (const s of stores.values()) void s.refresh(true);
  void cache.peek('courses');
}
