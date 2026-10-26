/**
 * Achievements (round 8): rewards for real study progress, read from Moodle's own data, that also teach KEX along the way.
 * Everything is computed and kept in this browser; nothing is sent anywhere. Names are ours (Moodle has no words for these).
 */

export type AchGroup = 'courses' | 'labs' | 'deadlines' | 'grades' | 'kex' | 'habits';

export const ACH_GROUPS: readonly AchGroup[] = ['courses', 'labs', 'deadlines', 'grades', 'kex', 'habits'];

export const ACH_IDS = [
  'first-tick', 'topic-cleared', 'halfway', 'course-complete',
  'lab-done', 'lab-streak', 'every-lab',
  'early-bird', 'clean-slate', 'photo-finish',
  'full-marks', 'steady-hand',
  'quick-search', 'pinned', 'keyboard-pilot', 'reader', 'explorer',
  'steady-streak', 'early-start', 'night-owl', 'fresh-start', 'collector',
] as const;

export type AchId = (typeof ACH_IDS)[number];

export interface AchDef {
  id: AchId;
  group: AchGroup;
  /** Shown as "???" until earned. */
  hidden?: boolean;
  /** Tiers I, II and III: the count each one needs. */
  tiers?: readonly [number, number, number];
  /** Read from grades (its own setting: grades are personal). */
  grades?: boolean;
}

export const CATALOG: readonly AchDef[] = [
  { id: 'first-tick', group: 'courses' },
  { id: 'topic-cleared', group: 'courses' },
  { id: 'halfway', group: 'courses' },
  { id: 'course-complete', group: 'courses', tiers: [1, 3, 3] },
  { id: 'lab-done', group: 'labs', tiers: [1, 5, 15] },
  { id: 'lab-streak', group: 'labs' },
  { id: 'every-lab', group: 'labs' },
  { id: 'early-bird', group: 'deadlines' },
  { id: 'clean-slate', group: 'deadlines' },
  { id: 'photo-finish', group: 'deadlines', hidden: true },
  { id: 'full-marks', group: 'grades', grades: true },
  { id: 'steady-hand', group: 'grades', grades: true },
  { id: 'quick-search', group: 'kex' },
  { id: 'pinned', group: 'kex' },
  { id: 'keyboard-pilot', group: 'kex' },
  { id: 'reader', group: 'kex' },
  { id: 'explorer', group: 'kex' },
  { id: 'steady-streak', group: 'habits' },
  { id: 'early-start', group: 'habits', hidden: true },
  { id: 'night-owl', group: 'habits', hidden: true },
  { id: 'fresh-start', group: 'habits' },
  { id: 'collector', group: 'habits' },
];

export const defOf = (id: AchId): AchDef => CATALOG.find((d) => d.id === id)!;

/** Collector needs this many others. */
export const COLLECTOR_AT = 15;
