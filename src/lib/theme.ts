import type { BootMirror, EffectsSetting, MotionSetting, ThemeSetting } from './settings';

export type ResolvedTheme = 'light' | 'dark';
export type SidebarMode = 'full' | 'rail' | 'drawer';

export function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  return setting === 'system' ? (prefersDark() ? 'dark' : 'light') : setting;
}

export function resolveMotion(setting: MotionSetting): 'reduced' | 'full' {
  if (setting === 'reduced') return 'reduced';
  if (setting === 'full') return 'full';
  return prefersReducedMotion() ? 'reduced' : 'full';
}

/** Sidebar layout from the viewport width (design-spec §11): >=1100 full, 760-1099 rail, <760 drawer. */
export function sidebarModeFor(width: number, collapsed: boolean): SidebarMode {
  if (width < 760) return 'drawer';
  if (width < 1100) return 'rail';
  return collapsed ? 'rail' : 'full';
}

export interface ShellAttrs {
  theme: ResolvedTheme;
  effects: EffectsSetting;
  motion: 'reduced' | 'full';
  sidebar: SidebarMode;
}

export function shellAttrs(m: Pick<BootMirror, 'theme' | 'effects' | 'motion' | 'sidebarCollapsed'>, width: number): ShellAttrs {
  return {
    theme: resolveTheme(m.theme),
    effects: m.effects,
    motion: resolveMotion(m.motion),
    sidebar: sidebarModeFor(width, m.sidebarCollapsed),
  };
}

export function applyShellAttrs(html: HTMLElement, a: ShellAttrs): void {
  html.dataset.kexTheme = a.theme;
  html.dataset.kexEffects = a.effects;
  html.dataset.kexMotion = a.motion;
  html.dataset.kexSidebar = a.sidebar;
}
