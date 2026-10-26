import type { Section } from './model';
import { isDateRange, type BlockModel, type GroupModel, type RowModel, type SectionView } from './topics';

/**
 * Series detection (round 8): labs, home assignments and weekly work, found from the course's own titles and activities rather
 * than from its shape. Replaces "any topic with four subsections is a lab track", which fit one course (Embedded Systems) and
 * would turn "Theory, Practice, Homework, Extra" into fake labs. Pure; the view decides what to do with the confidence:
 *   high   - the board shows on its own;
 *   medium - the topic offers a "Labs | List" switch, the list stays;
 *   low    - nothing (no result).
 * A board is only built when every activity of the topic appears in it exactly once (`sameCms`).
 */

export type Confidence = 'high' | 'medium';

export interface Numbered {
  /** The shared word, lower case ("lab", "home assignment", "praktikum"), or "#" for titles that start with a number. */
  key: string;
  num: number;
  /** "Lab Final", "Labor lõpp": joins its series at the end. */
  final: boolean;
}

const FINAL_RE = /^\s*(\p{L}[\p{L}'’]*)\s+(?:final|finaal\p{L}*|l[õo]pp\p{L}*|l[õo]putöö|exam|eksam|bonus|boonus|extra|lisa)\b/iu;
// "Lab 3", "Home assignment 2", "HW2", "Kodutöö nr 4", "Week 5": one or two words, then the number (not a date or a range).
const WORD_NUM_RE = /^\s*(\p{L}[\p{L}'’]*(?:[ -]\p{L}[\p{L}'’]*)?)\s*(?:nr\.?|no\.?|#)?\s*(\d{1,3})(?![\d]|[.,:/–-]\s?\d)/iu;
// "1. National digitalisation strategy", "3) Praktikum", "5. nädal".
const LEADING_RE = /^\s*(\d{1,3})\s*[.):](?!\d)\s*\S/u;

const normKey = (w: string): string => {
  const k = w.toLowerCase().replace(/\s+/g, ' ').trim();
  return k.length > 3 && k.endsWith('s') && /^[a-z ]+$/.test(k) ? k.slice(0, -1) : k;
};

/** The series numbering of a title, if it has one. Date ranges (weeks format) are not numbers. */
export function numbering(title: string): Numbered | null {
  if (!title || isDateRange(title)) return null;
  const f = FINAL_RE.exec(title);
  if (f) return { key: normKey(f[1] ?? ''), num: Number.POSITIVE_INFINITY, final: true };
  const w = WORD_NUM_RE.exec(title);
  if (w) return { key: normKey(w[1] ?? ''), num: Number(w[2]), final: false };
  const l = LEADING_RE.exec(title);
  if (l) return { key: '#', num: Number(l[1]), final: false };
  return null;
}

interface Family<T> {
  key: string;
  /** Members in display order, with their numbering. */
  members: { item: T; n: Numbered }[];
  /** Distinct numbers (finals not counted). */
  count: number;
  /** Share of the candidates that belong to the series. */
  coverage: number;
  /** Share of consecutive members whose number does not go down. */
  rising: number;
}

/** The largest family of siblings sharing a word and a number (or a leading number). */
function bestFamily<T>(items: readonly T[], title: (t: T) => string): Family<T> | null {
  const parsed = items.map((item) => ({ item, n: numbering(title(item)) }));
  const counts = new Map<string, Set<number>>();
  for (const p of parsed) if (p.n && !p.n.final) counts.set(p.n.key, (counts.get(p.n.key) ?? new Set()).add(p.n.num));
  let key: string | undefined;
  for (const [k, nums] of counts) if (!key || nums.size > (counts.get(key)?.size ?? 0)) key = k;
  if (!key) return null;
  const members = parsed.filter((p): p is { item: T; n: Numbered } => !!p.n && p.n.key === key);
  const nums = members.filter((m) => !m.n.final).map((m) => m.n.num);
  let up = 0;
  for (let i = 1; i < nums.length; i++) if ((nums[i] ?? 0) >= (nums[i - 1] ?? 0)) up++;
  return {
    key,
    members,
    count: counts.get(key)?.size ?? 0,
    coverage: items.length ? members.length / items.length : 0,
    rising: nums.length > 1 ? up / (nums.length - 1) : 1,
  };
}

/** Activity types that are work: something to hand in, answer or run. */
export const WORK_MODS: ReadonlySet<string> = new Set(['assign', 'quiz', 'vpl', 'workshop', 'h5pactivity', 'lesson', 'scorm']);

/** Something to do, not only to read: a submission, a quiz, a lab tool, or anything with a deadline. */
export const isWork = (r: RowModel): boolean => r.kind === 'assignment' || r.kind === 'quiz' || r.kind === 'practical' || WORK_MODS.has(r.cm.modname) || r.due !== undefined;

/** The four signals combined. Reading series ("Lecture 1" to "Lecture 4") stay lists. */
function confidence(f: Family<unknown>, work: number): Confidence | null {
  if (work < 0.5 || f.rising < 0.7) return null;
  if (f.count >= 3 && f.coverage >= 0.6) return 'high';
  if (f.count >= 2) return 'medium';
  return null;
}

export interface TopicSeries {
  shape: 'groups' | 'rows';
  confidence: Confidence;
  /** The series word, as in the titles ("lab", "#"). */
  key: string;
  /** The labs, in order: real subsections, or the numbered rows gathered under one card per number. */
  groups: GroupModel[];
  /** What the topic shows while the series is on. For subsections this is the topic as it is. */
  view: SectionView;
}

/** cm ids of a view, each as often as it appears. */
function cmIds(view: SectionView): number[] {
  return view.blocks.flatMap((b) => (b.type === 'row' ? [b.row.cm.id] : b.group.rows.map((r) => r.cm.id))).sort((a, b) => a - b);
}

/** No activity lost and none shown twice: the series view holds exactly the topic's activities. */
export function sameCms(a: SectionView, b: SectionView): boolean {
  const x = cmIds(a);
  const y = cmIds(b);
  return x.length === y.length && x.every((id, i) => id === y[i]);
}

const capital = (s: string): string => s.replace(/^\p{L}/u, (c) => c.toUpperCase());

/** Numbered activities gathered under one card per number, at the place of the first of them; other rows stay where they are. */
function rowSeriesView(view: SectionView, section: Section, members: { item: RowModel; n: Numbered }[]): { view: SectionView; groups: GroupModel[] } {
  const byNum = new Map<string, RowModel[]>();
  for (const m of members) {
    const k = m.n.final ? 'final' : String(m.n.num);
    byNum.set(k, [...(byNum.get(k) ?? []), m.item]);
  }
  const memberOf = new Map<number, string>();
  for (const m of members) memberOf.set(m.item.cm.id, m.n.final ? 'final' : String(m.n.num));
  const groups = new Map<string, GroupModel>();
  const blocks: BlockModel[] = [];
  for (const b of view.blocks) {
    const k = b.type === 'row' ? memberOf.get(b.row.cm.id) : undefined;
    if (k === undefined) {
      blocks.push(b);
      continue;
    }
    if (groups.has(k)) continue;
    const rows = byNum.get(k) ?? [];
    const first = rows[0];
    if (!first) continue;
    const tracked = rows.filter((r) => r.kind !== 'note' && r.cm.tracked);
    const n = numbering(first.cm.name);
    const title = rows.length === 1 ? first.cm.name : n && n.key !== '#' && !n.final ? `${capital(n.key)} ${n.num}` : first.cm.name;
    const group: GroupModel = {
      // Synthetic: below zero, so it never meets a real section id.
      section: { ...section, id: -first.cm.id, title, cmIds: rows.map((r) => r.cm.id), component: 'kex_series', parentId: section.id, summaryHtml: undefined, hasSummary: false, tileImage: undefined },
      title,
      rows,
      total: tracked.length,
      done: tracked.filter((r) => !r.incomplete).length,
    };
    groups.set(k, group);
    blocks.push({ type: 'group', group });
  }
  const rows = blocks.flatMap((b) => (b.type === 'row' ? [b.row] : b.group.rows));
  return { view: { blocks, rows }, groups: [...groups.values()] };
}

/**
 * The series of a topic, from its subsections first ("Lab 1 - Simple I/O" ... "Lab Final - Game"), else from its numbered
 * activities ("1. National digitalisation strategy", "2. Terms of use"). Null when there is none or it is not sure enough.
 */
export function detectTopicSeries(view: SectionView, section: Section): TopicSeries | null {
  const groups = view.blocks.flatMap((b): GroupModel[] => (b.type === 'group' ? [b.group] : []));
  if (groups.length >= 2) {
    const f = bestFamily(groups, (g) => g.title);
    if (f) {
      const work = f.members.filter((m) => m.item.rows.some(isWork)).length / f.members.length;
      const c = confidence(f, work);
      if (c) return { shape: 'groups', confidence: c, key: f.key, groups: f.members.map((m) => m.item), view };
    }
  }
  const rows = view.blocks.flatMap((b): RowModel[] => (b.type === 'row' && b.row.kind !== 'note' ? [b.row] : []));
  if (rows.length < 2) return null;
  const f = bestFamily(rows, (r) => r.cm.name);
  if (!f) return null;
  const units = new Map<string, boolean>();
  for (const m of f.members) {
    const k = m.n.final ? 'final' : String(m.n.num);
    units.set(k, (units.get(k) ?? false) || isWork(m.item));
  }
  const work = [...units.values()].filter(Boolean).length / Math.max(1, units.size);
  const c = confidence(f, work);
  if (!c) return null;
  const built = rowSeriesView(view, section, f.members);
  // Fail safe: the cards must hold every activity of the topic exactly once, or the topic stays a list.
  if (!sameCms(view, built.view)) return null;
  return { shape: 'rows', confidence: c, key: f.key, groups: built.groups, view: built.view };
}

export interface CourseTopicInput {
  number: number;
  title: string;
  /** The topic holds something to do (a submission, a quiz, a deadline). */
  work: boolean;
}

/**
 * Topics that are themselves a series ("Lab 1" ... "Lab 8" as topics, or a weeks-format course with work each week):
 * the section numbers of the members, in order, when sure (high confidence only); else null.
 */
export function detectCourseSeries(topics: readonly CourseTopicInput[]): number[] | null {
  const cand = topics.filter((t) => t.number > 0);
  if (cand.length < 3) return null;
  const weeks = cand.filter((t) => isDateRange(t.title));
  if (weeks.length >= Math.max(3, cand.length * 0.6)) {
    const work = weeks.filter((t) => t.work).length / weeks.length;
    return work >= 0.5 ? weeks.map((t) => t.number) : null;
  }
  const f = bestFamily(cand, (t) => t.title);
  if (!f) return null;
  const work = f.members.filter((m) => m.item.work).length / f.members.length;
  return confidence(f, work) === 'high' ? f.members.map((m) => m.item.number) : null;
}
