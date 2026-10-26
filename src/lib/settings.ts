import { onStorageChanged, storageGet, storageSet } from './storage';
import { safeLocalStorage } from './dom';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type EffectsSetting = 'animated' | 'static' | 'off';
export type MotionSetting = 'system' | 'reduced' | 'full';
export type RouteMode = 'app' | 'skin' | 'off';
export type Density = 'comfortable' | 'compact';

/** Reader (side panel) preferences: text size step 0-4 (14-22 px), measure, line spacing, family, placement and the side panel width. */
export interface ReaderPrefs {
  size: number;
  width: 'narrow' | 'medium' | 'wide';
  leading: 'tight' | 'normal' | 'loose';
  font: 'sans' | 'serif';
  mode: 'side' | 'center' | 'full';
  /** Side panel width as a fraction of the window (0.36-0.8). */
  side: number;
}

export const DEFAULT_READER: ReaderPrefs = { size: 1, width: 'medium', leading: 'normal', font: 'sans', mode: 'side', side: 0.5 };

export interface Settings {
  enabled: boolean;
  theme: ThemeSetting;
  effects: EffectsSetting;
  motion: MotionSetting;
  /** 'auto' follows Moodle's own language (<html lang>). */
  uiLanguage: 'auto' | 'en' | 'et';
  /** Colour course pages and heroes by school (first letter of the course code). */
  colourBySchool: boolean;
  sidebarSource: 'moodle' | 'inprogress' | 'starred' | 'all';
  sidebarCollapsed: boolean;
  courseAliases: Record<string, string>;
  courseOrder: number[];
  routeModes: Record<string, RouteMode>;
  showOffPill: boolean;
  openInNewTab: 'never' | 'external' | 'always';
  /** Compact course rows (52 px) everywhere; topics with four or more labs always use them. */
  density: Density;
  reader: ReaderPrefs;
  /** Moodle site notices the user hid, by a hash of their text (a changed notice shows again). */
  hiddenNotices: string[];
  /** Labs, home assignments and weekly work shown as a board when KEX is sure ('auto'), or always as Moodle's list ('off'). */
  labsView: 'auto' | 'off';
  /** The reader's own Labs or List choice per topic, by `courseId:sectionId`. */
  seriesChoice: Record<string, 'labs' | 'list'>;
  debug: { freezeTime?: number; selectorReport?: boolean; logLevel?: 'warn' | 'debug' };
}

export const SETTINGS_KEY = 'kex:settings';
export const BOOT_KEY = 'kex.boot';

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  theme: 'system',
  effects: 'animated',
  motion: 'system',
  uiLanguage: 'auto',
  colourBySchool: true,
  sidebarSource: 'moodle',
  sidebarCollapsed: false,
  courseAliases: {},
  courseOrder: [],
  routeModes: {},
  showOffPill: true,
  openInNewTab: 'external',
  density: 'comfortable',
  reader: DEFAULT_READER,
  hiddenNotices: [],
  labsView: 'auto',
  seriesChoice: {},
  debug: {},
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

function normalizeReader(raw: unknown): ReaderPrefs {
  const d = DEFAULT_READER;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);
  return {
    size: Math.round(num(r.size, 0, 4, d.size)),
    width: pick(r.width, ['narrow', 'medium', 'wide'], d.width),
    leading: pick(r.leading, ['tight', 'normal', 'loose'], d.leading),
    font: pick(r.font, ['sans', 'serif'], d.font),
    mode: pick(r.mode, ['side', 'center', 'full'], d.mode),
    side: num(r.side, 0.36, 0.8, d.side),
  };
}

/** `courseId:sectionId` -> 'labs' | 'list', the newest 200. */
function seriesChoices(raw: unknown): Settings['seriesChoice'] {
  const out: Settings['seriesChoice'] = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw).slice(-200)) if (/^\d+:\d+$/.test(k) && (v === 'labs' || v === 'list')) out[k] = v;
  return out;
}

/** Merge a stored (possibly old or hand-edited) value over the defaults, dropping invalid fields. */
export function normalizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rec = (v: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (v && typeof v === 'object') for (const [k, val] of Object.entries(v)) if (typeof val === 'string' && val.trim()) out[k] = val;
    return out;
  };
  const modes: Record<string, RouteMode> = {};
  if (r.routeModes && typeof r.routeModes === 'object') {
    for (const [k, v] of Object.entries(r.routeModes)) if (v === 'app' || v === 'skin' || v === 'off') modes[k] = v;
  }
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    theme: pick(r.theme, ['system', 'light', 'dark'], d.theme),
    effects: pick(r.effects, ['animated', 'static', 'off'], d.effects),
    motion: pick(r.motion, ['system', 'reduced', 'full'], d.motion),
    uiLanguage: pick(r.uiLanguage, ['auto', 'en', 'et'], d.uiLanguage),
    colourBySchool: typeof r.colourBySchool === 'boolean' ? r.colourBySchool : d.colourBySchool,
    sidebarSource: pick(r.sidebarSource, ['moodle', 'inprogress', 'starred', 'all'], d.sidebarSource),
    sidebarCollapsed: typeof r.sidebarCollapsed === 'boolean' ? r.sidebarCollapsed : d.sidebarCollapsed,
    courseAliases: rec(r.courseAliases),
    courseOrder: Array.isArray(r.courseOrder) ? r.courseOrder.filter((n): n is number => Number.isInteger(n)) : [],
    routeModes: modes,
    showOffPill: typeof r.showOffPill === 'boolean' ? r.showOffPill : d.showOffPill,
    openInNewTab: pick(r.openInNewTab, ['never', 'external', 'always'], d.openInNewTab),
    density: pick(r.density, ['comfortable', 'compact'], d.density),
    reader: normalizeReader(r.reader),
    hiddenNotices: Array.isArray(r.hiddenNotices) ? r.hiddenNotices.filter((x): x is string => typeof x === 'string').slice(-50) : [],
    labsView: pick(r.labsView, ['auto', 'off'], d.labsView),
    seriesChoice: seriesChoices(r.seriesChoice),
    debug: r.debug && typeof r.debug === 'object' ? (r.debug as Settings['debug']) : {},
  };
}

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await storageGet(SETTINGS_KEY));
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  await storageSet({ [SETTINGS_KEY]: next });
  return next;
}

export function watchSettings(cb: (s: Settings) => void): () => void {
  return onStorageChanged((changes) => {
    const c = changes[SETTINGS_KEY];
    if (c) cb(normalizeSettings(c.newValue));
  });
}

/** Non-sensitive mirror of the first-paint settings, kept in page localStorage ("kex.boot"). */
export interface BootMirror {
  enabled: boolean;
  theme: ThemeSetting;
  effects: EffectsSetting;
  motion: MotionSetting;
  sidebarCollapsed: boolean;
}

export const DEFAULT_MIRROR: BootMirror = {
  enabled: true,
  theme: 'system',
  effects: 'animated',
  motion: 'system',
  sidebarCollapsed: false,
};

export function toBootMirror(s: Settings): BootMirror {
  return { enabled: s.enabled, theme: s.theme, effects: s.effects, motion: s.motion, sidebarCollapsed: s.sidebarCollapsed };
}

export function readBootMirror(): BootMirror {
  try {
    const raw = safeLocalStorage()?.getItem(BOOT_KEY);
    if (!raw) return DEFAULT_MIRROR;
    const n = normalizeSettings(JSON.parse(raw));
    return toBootMirror(n);
  } catch {
    return DEFAULT_MIRROR;
  }
}

export function writeBootMirror(m: BootMirror): void {
  try {
    safeLocalStorage()?.setItem(BOOT_KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable: the shell still works, first paint just uses defaults */
  }
}
