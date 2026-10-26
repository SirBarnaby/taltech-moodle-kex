import { batch, effect, signal } from '@preact/signals';
import { cache } from '../data/cache';
import { cmDetails } from '../data/repo/cmdetails';
import { cmsOfSection, topicSections, type CourseState } from '../data/repo/coursestate';
import { currentSemester } from '../data/repo/courses';
import { eventsStore } from '../data/repo/events';
import { lastAccess } from '../data/repo/mycourses';
import { pinsStore } from '../data/repo/pins';
import { cachedStates, statesVersion } from '../data/repo/prefetch';
import type { CourseGradeReport } from '../data/scrape/grades';
import { detectCourseSeries, detectTopicSeries, WORK_MODS } from '../data/series';
import { buildSectionView } from '../data/topics';
import { termAt } from '../lib/academic-calendar';
import { recordError } from '../lib/log';
import { activeCourseId, settings, sidebarCourses } from '../state';
import { previewCmId } from '../state/course';
import { ACH_IDS, CATALOG, COLLECTOR_AT, defOf, type AchId } from './catalog';
import { emptyJournal, noteCourse, noteDeadlines, noteKey, noteUse, noteVisit, readJournal, type Journal } from './journal';
import { evaluate, type CourseFacts, type Facts, type LabSeries, type Status } from './rules';

/**
 * Runs the achievements in this tab (round 8): keeps the journal, gathers the facts from what KEX already holds (no extra
 * requests), evaluates in idle time after the data changes, and stores what was earned, per user, in this browser only.
 * The first run unlocks what is already done quietly and says so once.
 */

export interface Earned {
  at: number;
  tier?: 1 | 2 | 3;
  courseId?: number;
  topic?: number;
}

interface Stored {
  earned: Partial<Record<AchId, Earned>>;
  /** The first run (quiet backfill) is done. */
  init: boolean;
  /** The last run's progress bars: the page opens with them, so the cards do not grow when the first run in this page lands. */
  progress?: Partial<Record<AchId, { n: number; of: number }>>;
}

export interface Unlock {
  key: number;
  id: AchId;
  tier?: 1 | 2 | 3;
}

const STATE = 'ach:state';
const JOURNAL = 'ach:journal';

/** What is earned (empty until the engine runs). */
export const earned = signal<Partial<Record<AchId, Earned>>>({});
/** The latest evaluation: progress towards what is not earned yet. */
export const statuses = signal<Partial<Record<AchId, Status>>>({});
/** Unlocks waiting for (or showing in) a toast, oldest first. */
export const unlocks = signal<Unlock[]>([]);
/** The quiet first run found this many: one toast says so. */
export const backfilled = signal(0);
/** The card the page should bring into view (from a toast's "View"). */
export const focusAch = signal<AchId | null>(null);

let journal: Journal = emptyJournal();
const journalVersion = signal(0);
let running = false;
let stops: (() => void)[] = [];
let saveTimer: number | undefined;
let evalTimer: number | undefined;
let unlockKey = 1;
/** This page holds the first run: what it finds is already done, so it unlocks quietly (one toast says how many). */
let quiet = false;

function setJournal(next: Journal): void {
  if (next === journal) return;
  journal = next;
  journalVersion.value = journalVersion.peek() + 1;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void cache.write(JOURNAL, journal), 1200);
}

/** The palette's search was used to open something. */
export function noteSearch(): void {
  if (running) setJournal(noteUse(journal, 'search', Date.now()));
}

/** A keyboard shortcut ran ("ctrl+k", "g w"). */
export function noteShortcut(keys: string): void {
  if (running) setJournal(noteKey(journal, keys));
}

const DONE = new Set([1, 2]);

/** Ticks, a cleared topic and the series of one course, from its cached state. */
export function courseFacts(state: CourseState, choices: Record<string, 'labs' | 'list'>): { course: CourseFacts; labs: LabSeries[] } {
  const tracked = state.cms.filter((c) => c.tracked && c.uservisible);
  const course: CourseFacts = { courseId: state.courseId, ticks: tracked.filter((c) => DONE.has(c.completion ?? 0)).length };
  const labs: LabSeries[] = [];
  const topics = topicSections(state).filter((s) => s.number > 0);
  const info = topics.map((section) => {
    const cms = cmsOfSection(state, section);
    const t = cms.filter((c) => c.tracked);
    const done = t.length > 0 && t.every((c) => DONE.has(c.completion ?? 0));
    if (course.clearedTopic === undefined && t.length >= 2 && done) course.clearedTopic = section.number;
    return { section, number: section.number, title: section.title, work: cms.some((c) => WORK_MODS.has(c.modname)), done, tracked: t.length };
  });
  for (const { section } of info) {
    const view = buildSectionView(section, { state, details: cmDetails.value, events: new Map(), fmtDue: () => '' });
    const series = detectTopicSeries(view, section);
    const choice = choices[`${state.courseId}:${section.id}`];
    if (!series || (choice ? choice !== 'labs' : series.confidence !== 'high')) continue;
    const groups = series.groups.filter((g) => g.total > 0);
    // A series nobody can tick off (no completion tracking) says nothing.
    if (groups.length >= 2) labs.push({ courseId: state.courseId, topic: section.number, done: groups.map((g) => g.done === g.total) });
  }
  const members = detectCourseSeries(info);
  if (members) {
    const done = members.map((n) => info.find((i) => i.number === n)).filter((i) => i && i.tracked > 0).map((i) => !!i?.done);
    if (done.length >= 2) labs.push({ courseId: state.courseId, done });
  }
  return { course, labs };
}

function gradeFacts(ids: readonly number[]): Facts['grades'] {
  const out: NonNullable<Facts['grades']> = [];
  for (const id of ids) {
    const report = cache.peek<CourseGradeReport>(`grades:course:${id}`)?.data;
    for (const [cmid, g] of Object.entries(report?.activities ?? {})) {
      const pct = g.percentage ?? (g.earned !== undefined && g.maximum ? (g.earned / g.maximum) * 100 : undefined);
      if (pct !== undefined && Number.isFinite(pct)) out.push({ courseId: id, cmid: Number(cmid), pct });
    }
  }
  return out;
}

function gather(now: number): Facts {
  const all = sidebarCourses.peek().filter((c) => !c.hidden);
  const sem = currentSemester(all);
  const current = all.filter((c) => !c.semester || (c.semester.season === sem.season && c.semester.year === sem.year));
  const access = lastAccess.peek();
  const choices = settings.peek().seriesChoice;
  const states: CourseFacts[] = [];
  const labs: LabSeries[] = [];
  for (const st of cachedStates(current.map((c) => c.id))) {
    try {
      const f = courseFacts(st, choices);
      states.push(f.course);
      labs.push(...f.labs);
    } catch (e) {
      recordError('achievements.course', e);
    }
  }
  return {
    now,
    courses: current.map((c) => ({ id: c.id, progress: c.progress, opened: journal.opened.includes(c.id) || access.has(c.id) })),
    states,
    labs,
    grades: settings.peek().achievementGrades ? gradeFacts(current.map((c) => c.id)) : null,
    pins: (pinsStore().value.peek() ?? []).length,
    journal,
    earned: new Set(Object.keys(earned.peek()) as AchId[]),
  };
}

function run(): void {
  const s = settings.peek();
  if (!running || !s.achievements) return;
  // Not before the courses and their states are known: a first run on half the data would toast the rest one by one later.
  if (!sidebarCourses.peek().length || !statesVersion.peek()) return;
  const now = Date.now();
  let result: Record<AchId, Status>;
  try {
    result = evaluate(gather(now));
  } catch (e) {
    recordError('achievements', e);
    return;
  }
  const stored = cache.peek<Stored>(STATE)?.data ?? { earned: {}, init: false };
  const next: Partial<Record<AchId, Earned>> = { ...stored.earned };
  const fresh: Unlock[] = [];
  for (const id of ACH_IDS) {
    const st = result[id];
    if (!st.earned || (defOf(id).grades && !s.achievementGrades)) continue;
    const had = next[id];
    if (had && (had.tier ?? 0) >= (st.tier ?? 0)) continue;
    next[id] = { at: now, tier: st.tier, courseId: st.courseId ?? had?.courseId, topic: st.topic ?? had?.topic };
    fresh.push({ key: unlockKey++, id, tier: st.tier });
  }
  // The Collector counts what was just earned too.
  if (!next.collector && Object.keys(next).length >= COLLECTOR_AT) {
    next.collector = { at: now };
    fresh.push({ key: unlockKey++, id: 'collector' });
  }
  // The rules counted what was earned before this run; the Collector's bar counts what this run added too.
  const others = Object.keys(next).filter((id) => id !== 'collector').length;
  if (!next.collector && result.collector.progress) result = { ...result, collector: { ...result.collector, progress: { n: Math.min(others, COLLECTOR_AT), of: COLLECTOR_AT } } };
  if (!stored.init) quiet = true;
  batch(() => {
    statuses.value = result;
    if (!fresh.length) return;
    earned.value = next;
    if (quiet) backfilled.value = backfilled.peek() + fresh.length;
    else if (s.achievementToasts) unlocks.value = [...unlocks.peek(), ...fresh];
  });
  const progress: Partial<Record<AchId, { n: number; of: number }>> = {};
  for (const id of ACH_IDS) if (result[id].progress) progress[id] = result[id].progress;
  const progressChanged = JSON.stringify(progress) !== JSON.stringify(stored.progress ?? {});
  if (fresh.length || !stored.init || progressChanged) void cache.write(STATE, { earned: next, init: true, progress } satisfies Stored);
}

/** The Achievements page opens before the first idle-time run: run it now, so its cards open with their progress bars. */
export function evaluateNow(): void {
  if (!Object.keys(statuses.peek()).length) run();
}

const idle = (fn: () => void): void => {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 3000 });
  else window.setTimeout(fn, 300);
};

function schedule(): void {
  window.clearTimeout(evalTimer);
  evalTimer = window.setTimeout(() => idle(run), 1200);
}

/** Start in this page (a signed-in page with the cache bound). Returns the stop function. */
export function startAchievements(): () => void {
  if (running) return stopAchievements;
  running = true;
  journal = readJournal(cache.peek<Journal>(JOURNAL)?.data);
  const stored = cache.peek<Stored>(STATE)?.data;
  earned.value = stored?.earned ?? {};
  if (stored?.progress && !Object.keys(statuses.peek()).length) {
    const seed: Partial<Record<AchId, Status>> = {};
    for (const [id, progress] of Object.entries(stored.progress) as [AchId, { n: number; of: number }][]) seed[id] = { earned: !!stored.earned[id], progress };
    statuses.value = seed;
  }
  const now = Date.now();
  const term = termAt(now / 1000);
  setJournal(noteVisit(journal, now, term?.start, term?.week !== undefined && term.week <= 2));
  let lastEvents = 0;
  stops = [
    effect(() => {
      const id = activeCourseId.value;
      if (id) setJournal(noteCourse(journal, id));
    }),
    effect(() => {
      if (previewCmId.value) setJournal(noteUse(journal, 'reader', Date.now()));
    }),
    effect(() => {
      // A new look at the deadline list (not the cached copy shown at load).
      const store = eventsStore();
      const at = store.at.value;
      const items = store.value.value;
      // (The copy cached at load was looked at when it was fetched; noteDeadlines skips a look it has seen.)
      if (!items || !at || at === lastEvents) return;
      lastEvents = at;
      const states = new Map(cachedStates([...new Set(items.map((i) => i.courseId))]).flatMap((st) => st.cms.map((c) => [c.id, c] as const)));
      setJournal(noteDeadlines(journal, items, at, (cmid) => {
        const cm = states.get(cmid);
        return cm?.tracked ? DONE.has(cm.completion ?? 0) : undefined;
      }));
    }),
    effect(() => {
      // Anything the rules read: evaluate again a moment later, in idle time.
      void statesVersion.value;
      void sidebarCourses.value;
      void pinsStore().value.value;
      void lastAccess.value;
      void journalVersion.value;
      const s = settings.value;
      void s.achievements;
      void s.achievementGrades;
      void s.seriesChoice;
      schedule();
    }),
  ];
  return stopAchievements;
}

export function stopAchievements(): void {
  if (!running) return;
  running = false;
  stops.forEach((s) => s());
  stops = [];
  window.clearTimeout(evalTimer);
  window.clearTimeout(saveTimer);
  void cache.write(JOURNAL, journal);
}

/** The toast for `key` is done. */
export function dropUnlock(key: number): void {
  unlocks.value = unlocks.peek().filter((u) => u.key !== key);
}

/** How many are earned, of how many there are (grade ones not counted while they are off). */
export function achCount(): { n: number; of: number } {
  const gradesOn = settings.value.achievementGrades;
  const defs = CATALOG.filter((d) => gradesOn || !d.grades);
  const e = earned.value;
  return { n: defs.filter((d) => e[d.id]).length, of: defs.length };
}
