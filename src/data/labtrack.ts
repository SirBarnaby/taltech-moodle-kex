import type { BlockModel, GroupModel, RowModel } from './topics';

/**
 * Lab track: a topic made of many subsections (Embedded Systems has 13 labs in one topic) reads as a strip of labs, with the
 * next one open and the rest folded to one line. Pure over the section view; the folding itself lives in state.
 */

export type LabState = 'done' | 'overdue' | 'next' | 'todo';

export interface LabTrackItem {
  group: GroupModel;
  state: LabState;
  /** Short chip text: "Lab 3", "3. praktikum", or the title cut to a few words. */
  short: string;
  /** The deadline that matters: the earliest one still to do, else the last one. Unix seconds. */
  due?: number;
  dueText?: string;
}

/** Topics with this many subsections become a track. */
export const TRACK_MIN = 4;

export function isTrack(blocks: readonly BlockModel[]): boolean {
  return blocks.filter((b) => b.type === 'group').length >= TRACK_MIN;
}

const NUMBERED = /^\s*(?:(lab(?:or(?:atoorne|i)?)?|praktikum|harjutus|homework|kodut[öo]{2}|exercise|practice|assignment|week|n[äa]dal|workshop|seminar|tund|task|[üu]lesanne)\s*\.?\s*(?:no\.?\s*)?(\d{1,3}[a-z]?))\b/iu;
const LEADING_NUMBER = /^\s*(\d{1,3}[a-z]?)\s*[.):]\s*(\p{L}+)/u;

export function shortLabel(title: string): string {
  const m = NUMBERED.exec(title);
  if (m) return `${(m[1] ?? '').replace(/^./u, (c) => c.toUpperCase())} ${m[2] ?? ''}`.trim();
  const n = LEADING_NUMBER.exec(title);
  if (n) return `${n[1]}. ${n[2]}`;
  const words = title.trim().split(/\s+/);
  let out = '';
  for (const w of words) {
    if ((out + ' ' + w).trim().length > 18) break;
    out = (out + ' ' + w).trim();
  }
  return out || title.slice(0, 18);
}

/** Still to do: incomplete, or (without completion tracking) an action Moodle still lists, such as an assignment not handed in. */
const pending = (r: RowModel): boolean => r.incomplete || (!r.cm.tracked && !!r.overdue);

function dueOf(g: GroupModel): { due?: number; dueText?: string } {
  const dated = g.rows.filter((r) => r.due !== undefined);
  const todo = dated.filter(pending).sort((a, b) => (a.due ?? 0) - (b.due ?? 0))[0];
  const last = dated.sort((a, b) => (b.due ?? 0) - (a.due ?? 0))[0];
  const pick = todo ?? last;
  return pick ? { due: pick.due, dueText: pick.dueText } : {};
}

const isDone = (g: GroupModel): boolean => g.total > 0 && g.done === g.total;
const isOverdue = (g: GroupModel): boolean => g.rows.some((r) => pending(r) && !!r.overdue);

/**
 * Done when every tracked activity is complete, overdue when one of its deadlines passed undone. "Next" is the first lab that is
 * neither: with no completion tracking at all, the first lab whose deadline is still ahead (or the first lab).
 */
export function buildTrack(groups: readonly GroupModel[], nowSec: number): LabTrackItem[] {
  const items: LabTrackItem[] = groups.map((group) => ({
    group,
    state: isDone(group) ? 'done' : isOverdue(group) ? 'overdue' : 'todo',
    short: shortLabel(group.title),
    ...dueOf(group),
  }));
  const tracked = groups.some((g) => g.total > 0);
  const next = tracked
    ? items.find((i) => i.state === 'todo')
    : (items.find((i) => i.due !== undefined && i.due >= nowSec) ?? items.find((i) => i.state === 'todo'));
  if (next) next.state = 'next';
  return items;
}

/** The lab open by default: the next one, else the first overdue one, else the first. Overdue labs stay marked on their chips. */
export function defaultOpen(items: readonly LabTrackItem[]): number[] {
  const pick = items.find((i) => i.state === 'next') ?? items.find((i) => i.state === 'overdue') ?? items[0];
  return pick ? [pick.group.section.id] : [];
}
