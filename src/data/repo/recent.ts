import { cache, type Store } from '../cache';
import { parseCode } from '../names';
import { decodeEntities } from '../../lib/sanitize';
import { ws } from '../ws';

/** Recently opened activities (`block_recentlyaccesseditems_get_recent_items`), 5 min TTL. */

export interface RecentItem {
  cmid: number;
  courseId: number;
  courseCode: string;
  courseName: string;
  title: string;
  modname: string;
  url: string;
  /** `f/pdf`-style key from the icon markup, when present. */
  iconKey?: string;
  accessedAt: number;
}

interface RawRecent {
  cmid: number;
  courseid: number;
  name: string;
  modname: string;
  coursename?: string;
  viewurl?: string;
  timeaccess: number;
  icon?: string;
}

export function mapRecent(raw: readonly RawRecent[]): RecentItem[] {
  return raw.map((r) => ({
    cmid: r.cmid,
    courseId: r.courseid,
    courseCode: parseCode('', r.coursename ?? ''),
    courseName: r.coursename ?? '',
    title: decodeEntities(r.name),
    modname: r.modname,
    url: r.viewurl ?? '',
    iconKey: /\/(f\/[a-z0-9-]+)/i.exec(r.icon ?? '')?.[1],
    accessedAt: r.timeaccess,
  }));
}

let store: Store<RecentItem[]> | undefined;

export function recentStore(): Store<RecentItem[]> {
  store ??= cache.swr<RecentItem[]>('recent', 5 * 60 * 1000, async () => {
    const res = await ws.call<RawRecent[]>('block_recentlyaccesseditems_get_recent_items', { limit: 9 });
    return mapRecent(res);
  });
  return store;
}
