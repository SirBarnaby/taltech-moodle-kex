import { quickSettingsOpen, resolvedTheme, settings, sidebarInstant, sidebarMode, sidebarOverlay, sidebarOverlays, userMenuOpen } from '../state';
import { updateSettings } from './settings';

type ViewTransitionDoc = Document & { startViewTransition?: (update: () => Promise<void> | void) => { ready: Promise<void>; finished: Promise<void> } };

/** Colour cross-fade when there is no view transition (Firefox before 144) or motion is reduced. */
const FADE_MS = 180;
/** The new theme grows as a circle from the moon button. */
const REVEAL_MS = 450;

function themeButtonCentre(): { x: number; y: number } {
  const r = document.querySelector('[data-kex-test="theme-toggle"], [data-kex-test="guest-theme"]')?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth - 40, y: 32 };
}

/** Show `next` (the attribute first, so the snapshot of the new state is complete), and remember it. */
export function switchTheme(next: 'light' | 'dark'): void {
  const html = document.documentElement;
  const apply = (): void => {
    html.dataset.kexTheme = next;
    updateSettings({ theme: next });
  };
  const doc = document as ViewTransitionDoc;
  const reduced = html.dataset.kexMotion === 'reduced';
  if (reduced || typeof doc.startViewTransition !== 'function' || document.hidden) {
    html.dataset.kexThemeFade = '';
    apply();
    window.setTimeout(() => delete html.dataset.kexThemeFade, FADE_MS + 40);
    return;
  }
  const { x, y } = themeButtonCentre();
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  html.dataset.kexThemeSwitch = '';
  const vt = doc.startViewTransition(async () => {
    apply();
    // Let Preact render the new icon and labels before the new state is captured.
    await new Promise((r) => setTimeout(r, 0));
  });
  void vt.ready.then(() => {
    html.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: REVEAL_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  }, () => undefined);
  void vt.finished.finally(() => delete html.dataset.kexThemeSwitch);
}

/** `t` and the moon button: flip between light and dark based on what is currently shown. */
export function toggleTheme(): void {
  switchTheme(resolvedTheme.value === 'dark' ? 'light' : 'dark');
}

export function toggleEffects(): void {
  updateSettings({ effects: settings.value.effects === 'off' ? 'animated' : 'off' });
}

export function toggleMotion(): void {
  updateSettings({ motion: settings.value.motion === 'reduced' ? 'full' : 'reduced' });
}

/** Full <-> rail where the window is wide enough for the full menu; otherwise open the menu above the page. */
let swapTimer = 0;

export function toggleSidebar(keyboard = false): void {
  sidebarInstant.value = keyboard;
  if (!sidebarOverlays.value) {
    // The course list changes shape between the full menu and the rail; it fades through the change instead of snapping (sidebar.css).
    const html = document.documentElement;
    html.dataset.kexSbSwitch = '';
    window.clearTimeout(swapTimer);
    swapTimer = window.setTimeout(() => delete html.dataset.kexSbSwitch, 420);
    updateSettings({ sidebarCollapsed: sidebarMode.value === 'full' });
    return;
  }
  quickSettingsOpen.value = false;
  userMenuOpen.value = false;
  const closing = sidebarOverlay.value;
  sidebarOverlay.value = !closing;
  if (closing && keyboard) document.querySelector<HTMLButtonElement>('[data-kex-test="sidebar-toggle"]')?.focus({ preventScroll: true });
}
