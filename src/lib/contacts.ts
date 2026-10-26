import { cache, type Store } from '../data/cache';
import { ws } from '../data/ws';

/** Course contacts (the teachers Moodle lists for a course), from `core_course_get_courses_by_field`. Cached a day per course. */
export interface Contact {
  id: number;
  fullname: string;
}

interface RawCourse {
  id: number;
  contacts?: { id: number; fullname: string }[];
}

/** "Marten" of "Marten Mets". */
export const firstName = (full: string | undefined): string => (full ?? '').trim().split(/\s+/)[0] ?? '';

export const CONTACTS_TTL_MS = 24 * 60 * 60 * 1000;

export function mapContacts(res: { courses?: RawCourse[] } | undefined, courseId: number): Contact[] {
  const c = res?.courses?.find((x) => x.id === courseId) ?? res?.courses?.[0];
  return (c?.contacts ?? [])
    .filter((p) => p && typeof p.fullname === 'string' && p.fullname.trim())
    .map((p) => ({ id: p.id, fullname: p.fullname.trim() }));
}

const stores = new Map<number, Store<Contact[]>>();

export function contactsStore(courseId: number): Store<Contact[]> {
  let s = stores.get(courseId);
  if (!s) {
    s = cache.swr<Contact[]>(`contacts:${courseId}`, CONTACTS_TTL_MS, async () =>
      mapContacts(await ws.call<{ courses?: RawCourse[] }>('core_course_get_courses_by_field', { field: 'id', value: String(courseId) }), courseId),
    );
    stores.set(courseId, s);
  }
  return s;
}

/** "Kati Tamm, Jaan Kask +1": the first two names, then a count. */
export function teacherLine(contacts: readonly Contact[], max = 2): string {
  const names = contacts.map((c) => c.fullname);
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
}
