import { computed, signal } from '@preact/signals';
import type { GradeRow } from '../data/scrape/grades';
import { hash, sidebarCourses } from './index';

/** Grade overview state (page-designs §8). Tabs Current / All live in the URL hash (`#all`). */

export type GradesTab = 'current' | 'all';

export const gradeRows = signal<GradeRow[]>([]);
export const grSel = signal<number | undefined>(undefined);

export const grTab = computed<GradesTab>(() => (hash.value === '#all' ? 'all' : 'current'));

/** Current = the courses of the sidebar; with no sidebar list yet (or no overlap) every row is shown rather than an empty page. */
export const visibleGrades = computed<GradeRow[]>(() => {
  const all = gradeRows.value;
  if (grTab.value === 'all') return all;
  const ids = new Set(sidebarCourses.value.map((c) => c.id));
  const cur = all.filter((r) => ids.has(r.courseId));
  return cur.length ? cur : ids.size ? [] : all;
});
