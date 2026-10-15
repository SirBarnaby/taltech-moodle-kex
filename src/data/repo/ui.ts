import { cache } from '../cache';
import type { TabKey } from '../classify';

/** Per-course UI memory: last topic and tab (`ui:{courseId}`), used for the "initial topic" rule (b). */
export interface CourseUi {
  topic?: number;
  tab?: TabKey;
  at: number;
}

const FOURTEEN_DAYS = 14 * 24 * 3600 * 1000;

export function readCourseUi(courseId: number): CourseUi | undefined {
  return cache.peek<CourseUi>(`ui:${courseId}`)?.data;
}

export function writeCourseUi(courseId: number, patch: Partial<Omit<CourseUi, 'at'>>): void {
  const cur = readCourseUi(courseId);
  void cache.write(`ui:${courseId}`, { ...cur, ...patch, at: Date.now() });
}

export const isRecentUi = (ui: CourseUi | undefined, now = Date.now()): boolean => !!ui && now - ui.at < FOURTEEN_DAYS;
