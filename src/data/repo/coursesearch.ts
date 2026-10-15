import { mapCourse, type RawCourse } from './courses';
import type { Course } from '../model';
import { ws } from '../ws';

/** "Other courses" in the palette: Moodle's own course search (`core_course_search_courses`), 8 results. */
export async function searchCourses(q: string, wwwroot: string, lang: 'en' | 'et'): Promise<Course[]> {
  const res = await ws.call<{ courses: RawCourse[] }>('core_course_search_courses', { criterianame: 'search', criteriavalue: q, page: 0, perpage: 8 });
  return (res.courses ?? []).map((c) => mapCourse(c, lang, wwwroot));
}
