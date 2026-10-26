import { cache } from '../cache';

/** Per-course UI memory (`ui:{courseId}`): where the reader was on the course page, and the topics they folded. */
export interface CourseUi {
  topic?: number;
  /** The topic at the top of the window and how far into it the reader was (px from its header), so the page reopens there. */
  anchor?: { topic: number; offset: number };
  /** Folded topics, by section id. */
  folded?: number[];
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
