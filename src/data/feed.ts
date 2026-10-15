import type { DueItem } from './model';
import type { Notif } from './repo/notifs';
import type { RecentItem } from './repo/recent';

/** The Workspace feed (happy-path §1): overdue, due in 7 days, Continue, updates, due in 8-14 days. */

export type FeedTab = 'all' | 'deadlines' | 'updates';

export type FeedItem =
  | { type: 'deadline'; key: string; item: DueItem }
  | { type: 'continue'; key: string; item: RecentItem }
  | { type: 'update'; key: string; item: Notif };

const DAY = 86400;
/** Content modules that count as "materials" for Continue (the rest has its own sections). */
const CONTINUE_MODS = new Set(['resource', 'url', 'page', 'book', 'folder', 'imscp', 'lesson', 'scorm', 'h5pactivity', 'lti', 'label']);

export interface FeedInput {
  due: readonly DueItem[];
  recent: readonly RecentItem[];
  notifs: readonly Notif[];
  /** Seconds. */
  now: number;
}

const dl = (item: DueItem): FeedItem => ({ type: 'deadline', key: `d${item.eventId}`, item });

export function continueItems(recent: readonly RecentItem[], n = 3): RecentItem[] {
  return recent.filter((r) => CONTINUE_MODS.has(r.modname)).sort((a, b) => b.accessedAt - a.accessedAt).slice(0, n);
}

export function buildFeed(tab: FeedTab, { due, recent, notifs, now }: FeedInput): FeedItem[] {
  const sorted = [...due].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due - b.due);
  const unread = notifs.filter((n) => !n.read).sort((a, b) => b.created - a.created);
  const update = (n: Notif): FeedItem => ({ type: 'update', key: `n${n.id}`, item: n });
  if (tab === 'deadlines') return sorted.map(dl);
  if (tab === 'updates') {
    const read = notifs.filter((n) => n.read).sort((a, b) => b.created - a.created);
    return [...unread, ...read].map(update);
  }
  const overdue = sorted.filter((d) => d.overdue);
  const soon = sorted.filter((d) => !d.overdue && d.due < now + 7 * DAY);
  const later = sorted.filter((d) => !d.overdue && d.due >= now + 7 * DAY && d.due < now + 14 * DAY);
  return [
    ...overdue.map(dl),
    ...soon.map(dl),
    ...continueItems(recent).map((r): FeedItem => ({ type: 'continue', key: `c${r.cmid}`, item: r })),
    ...unread.map(update),
    ...later.map(dl),
  ];
}

export interface WeekSummary {
  overdue: number;
  dueWeek: number;
}

export function weekSummary(due: readonly DueItem[], now: number): WeekSummary {
  return {
    overdue: due.filter((d) => d.overdue).length,
    dueWeek: due.filter((d) => !d.overdue && d.due < now + 7 * DAY).length,
  };
}

/** The soonest not-yet-overdue deadline per course (for the left column's "Next: Lab 6 · Thu"). */
export function nextByCourse(due: readonly DueItem[]): Map<number, DueItem> {
  const m = new Map<number, DueItem>();
  for (const d of [...due].filter((x) => !x.overdue).sort((a, b) => a.due - b.due)) if (!m.has(d.courseId)) m.set(d.courseId, d);
  return m;
}

/** Course with the nearest deadline (overdue counts as nearest). */
export function nearestCourse(due: readonly DueItem[]): number | undefined {
  return [...due].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due - b.due)[0]?.courseId;
}
