import type { FeedItem } from '../data/feed';

/** Workspace feed helpers: the in-place course filter and deadlines grouped by course. */

/** Only what belongs to course `courseId` (`code` is the code of that course: updates carry a course code, not an id). */
export function filterFeedByCourse(items: readonly FeedItem[], courseId: number | undefined, code: string | undefined): FeedItem[] {
  if (courseId === undefined) return [...items];
  return items.filter((i) => {
    if (i.type === 'deadline') return i.item.courseId === courseId;
    if (i.type === 'continue') return i.item.courseId === courseId;
    return !!code && i.item.courseCode === code;
  });
}

/**
 * Within every run of consecutive deadlines, bring the deadlines of one course together. Courses keep the order in which they
 * first appear (so overdue and nearest first), deadlines keep their order inside a course. Other items stay where they are.
 */
export function groupDeadlines(items: readonly FeedItem[]): FeedItem[] {
  const out: FeedItem[] = [];
  let run: Extract<FeedItem, { type: 'deadline' }>[] = [];
  const flush = (): void => {
    const order: number[] = [];
    const by = new Map<number, typeof run>();
    for (const d of run) {
      const id = d.item.courseId;
      if (!by.has(id)) {
        by.set(id, []);
        order.push(id);
      }
      by.get(id)?.push(d);
    }
    for (const id of order) out.push(...(by.get(id) ?? []));
    run = [];
  };
  for (const i of items) {
    if (i.type === 'deadline') run.push(i);
    else {
      flush();
      out.push(i);
    }
  }
  flush();
  return out;
}

/** True when item `i` of `list` is the first deadline of its course group (a course heading goes above it). */
export function startsCourseGroup(list: readonly FeedItem[], i: number): boolean {
  const cur = list[i];
  if (!cur || cur.type !== 'deadline') return false;
  const prev = list[i - 1];
  return !prev || prev.type !== 'deadline' || prev.item.courseId !== cur.item.courseId;
}
