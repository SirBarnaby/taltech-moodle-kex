import { matchText } from './fuzzy';

export type EntryType = 'course' | 'topic' | 'cm' | 'page' | 'action' | 'pin';
export type GroupKey = 'pins' | 'courses' | 'topics' | 'materials' | 'pages' | 'actions' | 'other';

export interface Entry {
  id: string;
  type: EntryType;
  title: string;
  subtitle?: string;
  courseCode?: string;
  courseId?: number;
  url?: string;
  kind?: string;
  format?: string;
  keywords: string[];
  /** Short mono label on the right of the row. */
  meta?: string;
  pinned?: boolean;
  /** Actions run a callback instead of navigating. */
  run?: () => void;
  /** Material entries can be pinned from the palette (Alt+P). */
  cmId?: number;
  modname?: string;
}

export interface ResultRow {
  entry: Entry;
  score: number;
  /** Highlight ranges in `entry.title`. */
  ranges: [number, number][];
}

export interface ResultGroup {
  key: GroupKey;
  /** The trailing "Search Moodle" row: no group header. */
  footer?: boolean;
  rows: ResultRow[];
}

export interface SearchContext {
  activeCourseId: number | null;
}

const GROUP_FOR: Record<EntryType, GroupKey> = {
  pin: 'pins',
  course: 'courses',
  topic: 'topics',
  cm: 'materials',
  page: 'pages',
  action: 'actions',
};

const GROUP_ORDER: GroupKey[] = ['pins', 'courses', 'topics', 'materials', 'pages', 'actions', 'other'];
const CAP = 8;
const EMPTY_CAP: Record<GroupKey, number> = { pins: 3, courses: CAP, topics: 0, materials: 0, pages: 5, actions: 4, other: 0 };

export const PREFIXES: Record<string, GroupKey> = { '>': 'actions', '@': 'courses', '#': 'topics', '!': 'materials' };

export function parseQuery(raw: string): { text: string; only: GroupKey | null } {
  const first = raw.charAt(0);
  const only = PREFIXES[first];
  if (only) return { text: raw.slice(1).trim(), only };
  return { text: raw.trim(), only: null };
}

function scoreEntry(text: string, e: Entry, ctx: SearchContext): { score: number; ranges: [number, number][] } | null {
  let best: { score: number; ranges: [number, number][] } | null = null;
  const consider = (m: ReturnType<typeof matchText>, penalty: number, ranges: boolean): void => {
    if (!m) return;
    const score = m.score - penalty;
    if (!best || score > best.score) best = { score, ranges: ranges ? m.ranges : [] };
  };
  consider(matchText(text, e.title), 0, true);
  // The course code counts as a title for courses and course-scoped rows ("iti" finds ITI8801).
  if (e.courseCode) consider(matchText(text, e.courseCode), e.type === 'course' ? 0 : 10, false);
  if (e.subtitle) consider(matchText(text, e.subtitle), 25, false);
  if (e.keywords.length) consider(matchText(text, e.keywords.join(' ')), 15, false);
  const found = best as { score: number; ranges: [number, number][] } | null;
  if (!found) return null;
  let bonus = 0;
  if (ctx.activeCourseId !== null && e.courseId === ctx.activeCourseId) bonus += 15;
  if (e.pinned) bonus += 12;
  return { score: found.score + bonus, ranges: found.ranges };
}

/** Group, score and cap the index for a raw query string (with optional prefix filter). */
export function search(entries: readonly Entry[], rawQuery: string, ctx: SearchContext): ResultGroup[] {
  const { text, only } = parseQuery(rawQuery);
  const groups = new Map<GroupKey, ResultRow[]>();
  const empty = text === '';
  entries.forEach((entry) => {
    const key = GROUP_FOR[entry.type];
    if (only && key !== only) return;
    if (key === 'pins' && !empty) return; // pins show on an empty query only (they are also found as materials)
    if (empty) {
      if (EMPTY_CAP[key] === 0 && !only) return;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push({ entry, score: entry.pinned ? 12 : 0, ranges: [] });
      return;
    }
    const r = scoreEntry(text, entry, ctx);
    if (!r) return;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push({ entry, score: r.score, ranges: r.ranges });
  });
  const out: ResultGroup[] = [];
  for (const key of GROUP_ORDER) {
    const rows = groups.get(key);
    if (!rows?.length) continue;
    // Array#sort is stable, so equal scores keep index order (the sidebar order for courses).
    const sorted = empty ? rows : [...rows].sort((a, b) => b.score - a.score);
    const cap = empty && !only ? EMPTY_CAP[key] : CAP;
    out.push({ key, rows: sorted.slice(0, cap) });
  }
  return out;
}
