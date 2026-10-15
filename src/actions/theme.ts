import { resolvedTheme, settings } from '../state';
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
