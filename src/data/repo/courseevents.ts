import { cache, type Store } from '../cache';
import { ws } from '../ws';

/** A deadline event of one cm, reduced to what the course page needs (no editurl/deleteurl, they carry a sesskey). */
export interface CmEvent {
  cmid: number;
  due: number;
  overdue: boolean;
  modulename: string;
  actionName?: string;
  actionUrl?: string;
  actionable?: boolean;
}

interface RawEvent {
  modulename?: string;
  timesort: number;
  overdue?: boolean;
  url?: string;
  action?: { name?: string; url?: string; actionable?: boolean };
}

export function mapEvents(events: readonly RawEvent[]): CmEvent[] {
  const out: CmEvent[] = [];
  for (const e of events) {
    const cmid = Number(/[?&]id=(\d+)/.exec(e.url ?? '')?.[1] ?? /[?&]id=(\d+)/.exec(e.action?.url ?? '')?.[1]);
    if (!Number.isFinite(cmid) || cmid <= 0) continue;
    out.push({
      cmid,
      due: e.timesort,
      overdue: !!e.overdue,
      modulename: e.modulename ?? '',
      actionName: e.action?.name,
      actionUrl: e.action?.url,
      actionable: e.action?.actionable,
    });
  }
  return out;
}

const stores = new Map<number, Store<CmEvent[]>>();

/** Deadlines of one course (5 min TTL). */
export function courseEventsStore(courseId: number): Store<CmEvent[]> {
  let s = stores.get(courseId);
  if (!s) {
    s = cache.swr<CmEvent[]>(`events:course:${courseId}`, 5 * 60 * 1000, async () => {
      const res = await ws.call<{ events: RawEvent[] }>('core_calendar_get_action_events_by_course', {
        courseid: courseId,
        // Two months back: the lab track marks every lab whose deadline passed undone, not only last fortnight's.
        timesortfrom: Math.floor(Date.now() / 1000) - 60 * 24 * 3600,
        limitnum: 50,
      });
      return mapEvents(res.events ?? []);
    });
    stores.set(courseId, s);
  }
  return s;
}
