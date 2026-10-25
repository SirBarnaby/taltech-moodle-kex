import { quickSettingsOpen, resolvedTheme, settings, sidebarInstant, sidebarMode, sidebarOverlay, userMenuOpen, viewportWidth } from '../state';
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

/** Keep the existing responsive sidebar when pinned; otherwise open it above the page. */
export function toggleSidebar(keyboard = false): void {
  sidebarInstant.value = keyboard;
  if (!settings.value.sidebarAutoHide && (sidebarMode.value === 'full' || (sidebarMode.value === 'rail' && !sidebarOverlay.value && viewportWidth.value >= 1100))) {
    updateSettings({ sidebarCollapsed: sidebarMode.value === 'full' });
    return;
  }
  quickSettingsOpen.value = false;
  userMenuOpen.value = false;
  const closing = sidebarOverlay.value;
  sidebarOverlay.value = !closing;
  if (closing && keyboard) document.querySelector<HTMLButtonElement>('[data-kex-test="sidebar-toggle"]')?.focus({ preventScroll: true });
}
