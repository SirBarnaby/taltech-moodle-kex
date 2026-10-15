import { cache, type Store } from '../cache';
import type { DueItem } from '../model';
import { parseCode } from '../names';
import { decodeEntities } from '../../lib/sanitize';
import { ws } from '../ws';

/** Deadlines of all courses (`core_calendar_get_action_events_by_timesort`), 5 min TTL (architecture §8.3, §8.5). */

interface RawEvent {
  id: number;
  name?: string;
  activityname?: string;
  modulename?: string;
  instance?: number;
  eventtype?: string;
  timesort: number;
  overdue?: boolean;
  url?: string;
  course?: { id: number; shortname?: string; fullname?: string; idnumber?: string };
  action?: { name?: string; url?: string; actionable?: boolean; itemcount?: number };
}

export interface RawEventsResponse {
  events: RawEvent[];
}

const idOf = (url: string | undefined): number | undefined => {
  const n = Number(/[?&]id=(\d+)/.exec(url ?? '')?.[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Pure mapping, unit-tested. Drops `editurl`/`deleteurl` (they carry a sesskey) by never copying them. */
export function mapDueItems(res: RawEventsResponse): DueItem[] {
  const out: DueItem[] = [];
  for (const e of res.events ?? []) {
    const title = decodeEntities(e.activityname || e.name || '').replace(/\s+(?:is due|closes|opens)$/i, '');
    out.push({
      eventId: e.id,
      cmid: idOf(e.url) ?? idOf(e.action?.url),
      courseId: e.course?.id ?? 0,
      courseCode: parseCode(e.course?.shortname ?? '', e.course?.fullname ?? '', e.course?.idnumber ?? ''),
      title,
      modname: e.modulename ?? '',
      due: e.timesort,
      overdue: !!e.overdue,
      actionName: e.action?.name,
      actionUrl: e.action?.actionable === false ? undefined : e.action?.url,
      url: e.url ?? e.action?.url ?? '',
    });
  }
  return out.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due - b.due);
}

export const EVENTS_TTL_MS = 5 * 60 * 1000;

let store: Store<DueItem[]> | undefined;

export function eventsStore(): Store<DueItem[]> {
  store ??= cache.swr<DueItem[]>('events', EVENTS_TTL_MS, async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await ws.call<RawEventsResponse>('core_calendar_get_action_events_by_timesort', {
      timesortfrom: now - 14 * 86400,
      timesortto: now + 60 * 86400,
      limitnum: 50,
      limittononsuspendedevents: true,
    });
    return mapDueItems(res);
  });
  return store;
}
