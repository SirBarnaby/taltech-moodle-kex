import { onStorageChanged, storageGet, storageSet } from './storage';
import { safeLocalStorage } from './dom';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type EffectsSetting = 'animated' | 'static' | 'off';
export type MotionSetting = 'system' | 'reduced' | 'full';
export type RouteMode = 'app' | 'skin' | 'off';

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
  debug: {},
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

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
