import { quickSettingsOpen, resolvedTheme, settings, sidebarInstant, sidebarMode, sidebarOverlay, sidebarOverlays, userMenuOpen } from '../state';
import { updateSettings } from './settings';

/** `t`: flip between light and dark based on what is currently shown. */
export function toggleTheme(): void {
  updateSettings({ theme: resolvedTheme.value === 'dark' ? 'light' : 'dark' });
}

export function toggleEffects(): void {
  updateSettings({ effects: settings.value.effects === 'off' ? 'animated' : 'off' });
}

export function toggleMotion(): void {
  updateSettings({ motion: settings.value.motion === 'reduced' ? 'full' : 'reduced' });
}

/** Full <-> rail where the window is wide enough for the full menu; otherwise open the menu above the page. */
export function toggleSidebar(keyboard = false): void {
  sidebarInstant.value = keyboard;
  if (!sidebarOverlays.value) {
    updateSettings({ sidebarCollapsed: sidebarMode.value === 'full' });
    return;
  }
  quickSettingsOpen.value = false;
  userMenuOpen.value = false;
  const closing = sidebarOverlay.value;
  sidebarOverlay.value = !closing;
  if (closing && keyboard) document.querySelector<HTMLButtonElement>('[data-kex-test="sidebar-toggle"]')?.focus({ preventScroll: true });
}
