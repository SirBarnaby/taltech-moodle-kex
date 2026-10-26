/**
 * The achievements' own notes (round 8): what Moodle cannot tell us later, kept in this browser only. Which days and at what
 * hours Moodle was opened, what of KEX was used, how many deadlines were overdue each day, and which open deadlines were seen
 * last time (so a deadline that leaves the list early, because it was handed in, can be noticed). Pure: every change returns
 * a new journal; the engine stores it.
 */

export interface Journal {
  v: 1;
  /** Local days (YYYY-MM-DD) Moodle was opened, oldest first (the last 60). */
  days: string[];
  /** First time Moodle was opened between 4:00 and 6:59, and between 0:00 and 3:59. */
  earlyAt?: number;
  nightAt?: number;
  /** Teaching terms seen (their start dates), oldest first, and when a new one first came after another. */
  terms: string[];
  freshAt?: number;
  /** First use of the palette's search and of the side reader. */
  searchAt?: number;
  readerAt?: number;
  /** Distinct shortcuts used ("ctrl+k", "g w"). */
  keys: string[];
  /** Course ids opened in KEX. */
  opened: number[];
  /** Most overdue deadlines seen on each day (the last 45 days). */
  overdue: Record<string, number>;
  /** Open deadlines (by cmid) at the last look: their course, due time and when they were last seen open (ms). */
  watch: Record<string, { courseId: number; due: number; seen: number }>;
  /** Deadlines that left the list before they were due: handed in somewhere in (after, before], due at `due` (ms). */
  handed: { cmid: number; courseId: number; due: number; after: number; before: number }[];
}

export const emptyJournal = (): Journal => ({ v: 1, days: [], terms: [], keys: [], opened: [], overdue: {}, watch: {}, handed: [] });

/** A stored journal, or a fresh one when it is missing or not ours. */
export function readJournal(raw: unknown): Journal {
  const j = raw as Partial<Journal> | undefined;
  if (!j || j.v !== 1) return emptyJournal();
  const arr = <T>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
  const str = (x: unknown): x is string => typeof x === 'string';
  const int = (x: unknown): x is number => Number.isInteger(x);
  const rec = <T>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> =>
    Object.fromEntries(Object.entries(v && typeof v === 'object' ? v : {}).filter(([, x]) => ok(x))) as Record<string, T>;
  const num = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
  return {
    v: 1,
    days: arr(j.days, str),
    earlyAt: num(j.earlyAt),
    nightAt: num(j.nightAt),
    terms: arr(j.terms, str),
    freshAt: num(j.freshAt),
    searchAt: num(j.searchAt),
    readerAt: num(j.readerAt),
    keys: arr(j.keys, str),
    opened: arr(j.opened, int),
    overdue: rec(j.overdue, (x): x is number => typeof x === 'number'),
    watch: rec(j.watch, (x): x is Journal['watch'][string] => !!x && typeof (x as { due?: unknown }).due === 'number' && typeof (x as { seen?: unknown }).seen === 'number'),
    handed: arr(j.handed, (x): x is Journal['handed'][number] => !!x && typeof (x as { cmid?: unknown }).cmid === 'number'),
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');
/** The local calendar day of a time. */
export const dayKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Moodle was opened at `now` (local time), in the teaching term `term` (its start date) if there is one. `termStart`: these are
 * the term's first two weeks (a first-ever visit then also counts as the start of a semester).
 */
export function noteVisit(j: Journal, now: number, term?: string, termStart = false): Journal {
  const day = dayKey(now);
  const hour = new Date(now).getHours();
  const days = j.days.includes(day) ? j.days : [...j.days, day].slice(-60);
  let { terms, freshAt } = j;
  if (term && !terms.includes(term)) {
    // A term after one already seen: the first visit of a new semester.
    if ((terms.length || termStart) && !freshAt) freshAt = now;
    terms = [...terms, term].slice(-6);
  }
  return {
    ...j,
    days,
    terms,
    freshAt,
    earlyAt: j.earlyAt ?? (hour >= 4 && hour < 7 ? now : undefined),
    nightAt: j.nightAt ?? (hour < 4 ? now : undefined),
  };
}

export function noteUse(j: Journal, what: 'search' | 'reader', now: number): Journal {
  if (what === 'search') return j.searchAt ? j : { ...j, searchAt: now };
  return j.readerAt ? j : { ...j, readerAt: now };
}

export function noteKey(j: Journal, keys: string): Journal {
  return j.keys.includes(keys) ? j : { ...j, keys: [...j.keys, keys].slice(-40) };
}

export function noteCourse(j: Journal, courseId: number): Journal {
  return j.opened.includes(courseId) ? j : { ...j, opened: [...j.opened, courseId].slice(-200) };
}

export interface OpenDeadline {
  cmid?: number;
  courseId: number;
  due: number;
  overdue: boolean;
}

/** The list can hold this many deadlines; a deadline can only be said to have left it when the list was not full. */
export const DEADLINE_LIST_MAX = 50;

/**
 * A fresh look at the open deadlines, fetched at `at` (ms). Records the day's overdue count, and notes every deadline seen
 * open last time that is gone now while still in the future: it was handed in (or done) between the two looks.
 * `done(cmid)` confirms it from the course's completion when that is known (false: not done, so not handed in).
 */
export function noteDeadlines(j: Journal, items: readonly OpenDeadline[], at: number, done: (cmid: number) => boolean | undefined): Journal {
  const day = dayKey(at);
  const overdueNow = items.filter((i) => i.overdue).length;
  const overdue = Object.fromEntries(
    Object.entries({ ...j.overdue, [day]: Math.max(j.overdue[day] ?? 0, overdueNow) })
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-45),
  );
  // An older look than one already taken (another tab, the copy cached at load): only its overdue count is news.
  if (Object.values(j.watch).some((w) => w.seen >= at)) return { ...j, overdue };
  const now = new Map(items.filter((i) => i.cmid).map((i) => [String(i.cmid), i]));
  const full = items.length >= DEADLINE_LIST_MAX;
  const handed = [...j.handed];
  for (const [cmid, w] of Object.entries(j.watch)) {
    if (now.has(cmid) || w.due <= at || full) continue;
    if (done(Number(cmid)) === false) continue;
    const prev = j.handed.find((h) => h.cmid === Number(cmid));
    if (!prev) handed.push({ cmid: Number(cmid), courseId: w.courseId ?? 0, due: w.due, after: w.seen, before: at });
  }
  const watch: Journal['watch'] = {};
  for (const i of items) if (i.cmid && !i.overdue && i.due * 1000 > at) watch[String(i.cmid)] = { courseId: i.courseId, due: i.due * 1000, seen: at };
  return { ...j, overdue, watch, handed: handed.slice(-50) };
}
