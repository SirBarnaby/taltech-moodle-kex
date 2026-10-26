import { COLLECTOR_AT, type AchId } from './catalog';
import { dayKey, type Journal } from './journal';

/**
 * The rules: pure functions over one snapshot of facts. The engine gathers the facts from what KEX already has (cached course
 * states, course progress, the deadline list, cached grade reports, pins) and the journal.
 */

export interface CourseFacts {
  courseId: number;
  /** Activities with completion tracking that are done. */
  ticks: number;
  /** A topic (not the course intro) with two or more tracked activities, all done. */
  clearedTopic?: number;
}

/** One series (labs, numbered home assignments, a course whose topics are labs), in order: done or not. */
export interface LabSeries {
  courseId: number;
  /** The topic it lives in (section number), absent for a course whose topics are the labs. */
  topic?: number;
  done: boolean[];
}

export interface Facts {
  now: number;
  /** The courses of the current semester, with Moodle's progress (null: no completion tracking). */
  courses: { id: number; progress: number | null; opened: boolean }[];
  states: CourseFacts[];
  labs: LabSeries[];
  /** Graded activities as percentages (null: grades are off for achievements). */
  grades: { courseId: number; cmid: number; pct: number }[] | null;
  pins: number;
  journal: Journal;
  /** Achievements already earned (for the Collector). */
  earned: ReadonlySet<AchId>;
}

export interface Status {
  earned: boolean;
  /** Tiered ones: the highest tier reached (1 to 3). */
  tier?: 1 | 2 | 3;
  /** Towards the next step: n of `of`. */
  progress?: { n: number; of: number };
  /** Where it was earned, to link the card to. */
  courseId?: number;
  topic?: number;
}

const ON: Status = { earned: true };
const progress = (n: number, of: number, where: Partial<Status> = {}): Status =>
  n >= of ? { ...where, earned: true } : { earned: false, progress: { n: Math.max(0, Math.min(n, of)), of } };

const tiered = (n: number, targets: readonly [number, number, number], where: Partial<Status> = {}): Status => {
  const tier = n >= targets[2] ? 3 : n >= targets[1] ? 2 : n >= targets[0] ? 1 : 0;
  const next = targets[Math.min(tier, 2)]!;
  return tier ? { ...where, earned: true, tier, progress: tier < 3 ? { n, of: next } : undefined } : { earned: false, progress: { n, of: targets[0] } };
};

const DAY = 86_400_000;

/** The longest run of weekdays (Monday to Friday) Moodle was opened on, weekends not breaking it. */
export function weekdayRun(days: readonly string[]): number {
  const set = new Set(days);
  let best = 0;
  for (const d of days) {
    let at = new Date(`${d}T12:00:00`);
    if (at.getDay() === 0 || at.getDay() === 6) continue;
    let run = 0;
    while (set.has(dayKey(at.getTime()))) {
      run++;
      do at = new Date(at.getTime() + DAY);
      while (at.getDay() === 0 || at.getDay() === 6);
    }
    best = Math.max(best, run);
  }
  return best;
}

/** Days since the last day with something overdue (or since the first record), counting only when the record is steady. */
export function cleanDays(overdue: Record<string, number>, now: number): { days: number; records: number } {
  const keys = Object.keys(overdue).sort();
  if (!keys.length) return { days: 0, records: 0 };
  let start = 0;
  for (let i = 0; i < keys.length; i++) if ((overdue[keys[i]!] ?? 0) > 0) start = i + 1;
  const clean = keys.slice(start);
  if (!clean.length) return { days: 0, records: 0 };
  const first = new Date(`${clean[0]}T12:00:00`).getTime();
  const today = new Date(`${dayKey(now)}T12:00:00`).getTime();
  return { days: Math.round((today - first) / DAY) + 1, records: clean.length };
}

/** The longest run of consecutive done labs in one series. */
const longestRun = (done: readonly boolean[]): number => {
  let best = 0;
  let run = 0;
  for (const d of done) {
    run = d ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
};

export function evaluate(f: Facts): Record<AchId, Status> {
  const j = f.journal;
  const ticks = f.states.reduce((n, s) => n + s.ticks, 0);
  const cleared = f.states.find((s) => s.clearedTopic !== undefined);
  const tracked = f.courses.filter((c) => c.progress !== null);
  const best = [...tracked].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];
  const complete = tracked.filter((c) => (c.progress ?? 0) >= 100);
  // I: one course, II: three, III: the whole semester (every course with completion tracking, at least three).
  const cc = complete.length;
  const ccTier = cc >= 3 && cc === tracked.length ? 3 : cc >= 3 ? 2 : cc >= 1 ? 1 : 0;
  const labsDone = f.labs.reduce((n, s) => n + s.done.filter(Boolean).length, 0);
  const firstLab = f.labs.find((s) => s.done.some(Boolean));
  const streak = f.labs.map((s) => ({ s, run: longestRun(s.done) })).sort((a, b) => b.run - a.run)[0];
  const everyLab = f.labs.find((s) => s.done.length >= 3 && s.done.every(Boolean));
  const mostLabs = [...f.labs].filter((s) => s.done.length >= 3).sort((a, b) => b.done.filter(Boolean).length / b.done.length - a.done.filter(Boolean).length / a.done.length)[0];
  const early = j.handed.find((h) => h.due - h.before >= 48 * 3600_000);
  const photo = j.handed.find((h) => h.due - h.after <= 3600_000 && h.before <= h.due);
  const clean = cleanDays(j.overdue, f.now);
  const grades = f.grades ?? [];
  const full = grades.find((g) => g.pct >= 99.95);
  const high = grades.filter((g) => g.pct >= 90);
  const opened = f.courses.filter((c) => c.opened).length;
  const others = [...f.earned].filter((id) => id !== 'collector').length;

  return {
    'first-tick': ticks > 0 ? ON : { earned: false },
    'topic-cleared': cleared ? { earned: true, courseId: cleared.courseId, topic: cleared.clearedTopic } : { earned: false },
    halfway: best && (best.progress ?? 0) >= 50 ? { earned: true, courseId: best.id } : { earned: false, progress: best ? { n: Math.round(best.progress ?? 0), of: 50 } : undefined },
    'course-complete': ccTier
      ? { earned: true, tier: ccTier, courseId: complete[0]?.id, progress: ccTier === 1 ? { n: cc, of: 3 } : ccTier === 2 ? { n: cc, of: tracked.length } : undefined }
      : { earned: false },
    'lab-done': tiered(labsDone, [1, 5, 15], { courseId: firstLab?.courseId, topic: firstLab?.topic }),
    'lab-streak': progress(streak?.run ?? 0, 3, { courseId: streak?.s.courseId, topic: streak?.s.topic }),
    'every-lab': everyLab
      ? { earned: true, courseId: everyLab.courseId, topic: everyLab.topic }
      : { earned: false, progress: mostLabs ? { n: mostLabs.done.filter(Boolean).length, of: mostLabs.done.length } : undefined },
    'early-bird': early ? { earned: true, courseId: early.courseId || undefined } : { earned: false },
    'clean-slate': clean.days >= 14 && clean.records >= 5 ? ON : { earned: false, progress: clean.records ? { n: Math.min(clean.days, 13), of: 14 } : undefined },
    'photo-finish': photo ? { earned: true, courseId: photo.courseId || undefined } : { earned: false },
    'full-marks': full ? { earned: true, courseId: full.courseId } : { earned: false },
    'steady-hand': progress(high.length, 5, { courseId: high[0]?.courseId }),
    'quick-search': j.searchAt ? ON : { earned: false },
    pinned: f.pins > 0 ? ON : { earned: false },
    'keyboard-pilot': progress(j.keys.length, 10),
    reader: j.readerAt ? ON : { earned: false },
    explorer: f.courses.length >= 2 ? progress(opened, f.courses.length) : { earned: false },
    'steady-streak': progress(weekdayRun(j.days), 5),
    'early-start': j.earlyAt ? ON : { earned: false },
    'night-owl': j.nightAt ? ON : { earned: false },
    'fresh-start': j.freshAt ? ON : { earned: false },
    collector: progress(others, COLLECTOR_AT),
  };
}
