import { computed, signal } from '@preact/signals';
import type { Course } from '../data/model';
import { COURSE_TABS, lastAccess, type CoursesTab } from '../data/repo/mycourses';
import { norm } from '../search/fuzzy';
import { collator } from '../i18n';
import { hash } from './index';

/** "My courses" state (page-designs §4). The tab lives in the URL hash (`#starred`), filter and sort in memory (sort is remembered). */

export type McSort = 'last' | 'name' | 'code';

const SORT_KEY = 'kex.mc.sort';

function readSort(): McSort {
  try {
    const v = window.localStorage.getItem(SORT_KEY);
    if (v === 'last' || v === 'name' || v === 'code') return v;
  } catch {
    /* private mode */
  }
  return 'last';
}

export const mcSort = signal<McSort>(readSort());
export function setMcSort(s: McSort): void {
  mcSort.value = s;
  try {
    window.localStorage.setItem(SORT_KEY, s);
  } catch {
    /* ignore */
  }
}

export const mcFilter = signal('');
/** Selected row (course id). */
export const mcSel = signal<number | undefined>(undefined);
/** Tabs offered (Archived only when the site has the custom field). */
export const mcHasArchived = signal(false);

export const mcTab = computed<CoursesTab>(() => {
  const h = hash.value.replace(/^#/, '');
  return (COURSE_TABS as readonly string[]).includes(h) && (h !== 'archived' || mcHasArchived.value) ? (h as CoursesTab) : 'current';
});

/** Diacritic-insensitive match on code, name, full name, alias and category. */
export function matchesFilter(c: Pick<Course, 'code' | 'name' | 'fullname' | 'alias' | 'category'>, q: string): boolean {
  const needle = norm(q).trim();
  if (!needle) return true;
  const hay = norm([c.code, c.name, c.fullname, c.alias, c.category].filter(Boolean).join(' '));
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export function sortCourses(list: readonly Course[], sort: McSort, access: ReadonlyMap<number, number>): Course[] {
  const col = collator();
  const byName = (a: Course, b: Course): number => col.compare(a.name, b.name);
  const out = [...list];
  if (sort === 'name') return out.sort(byName);
  if (sort === 'code') return out.sort((a, b) => col.compare(a.code, b.code) || byName(a, b));
  return out.sort((a, b) => (access.get(b.id) ?? 0) - (access.get(a.id) ?? 0) || byName(a, b));
}

export { lastAccess };

/**
 * The "last opened" order My courses shows: taken when the view opens, so the cards never reshuffle under the reader when Moodle's
 * fresh answer arrives (the course just left is already first: opening a course notes it). Only an empty order takes the answer.
 */
export const shownAccess = signal<ReadonlyMap<number, number>>(new Map());
