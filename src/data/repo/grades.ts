import { cache, type Store } from '../cache';
import { scrapeCourseGrades, type CourseGradeReport } from '../scrape/grades';
import { ws } from '../ws';

const stores = new Map<string, Store<CourseGradeReport>>();
const waiting: (() => void)[] = [];
let requests = 0;

/** Keep viewport-driven overview enrichment to two simultaneous HTML requests. */
async function fetchCourseGrades(courseId: number, scope: string): Promise<CourseGradeReport> {
  if (requests >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  requests++;
  try {
    const html = await ws.fetchText(`/grade/report/user/index.php?id=${courseId}`);
    if (cache.key(`grades:course:${courseId}`) !== scope) throw new Error('Moodle grade report scope changed');
    const report = scrapeCourseGrades(new DOMParser().parseFromString(html, 'text/html'));
    if (!report) throw new Error('Moodle grade report unavailable');
    return report;
  } finally {
    requests--;
    waiting.shift()?.();
  }
}

/** One cached user report serves every activity row and its course total (30 minute TTL). */
export function courseGradesStore(courseId: number): Store<CourseGradeReport> {
  const name = `grades:course:${courseId}`;
  const key = cache.key(name);
  let store = stores.get(key);
  if (!store) {
    store = cache.swr<CourseGradeReport>(name, 30 * 60 * 1000, () => fetchCourseGrades(courseId, key));
    stores.set(key, store);
  }
  return store;
}
