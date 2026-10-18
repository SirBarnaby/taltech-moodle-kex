import { neutralizeThemeLinkBackground } from './themefix';

export type KexMode = 'boot' | 'app' | 'skin' | 'off';

/** `html[data-kex]` drives the CSS gate and which stylesheet layers apply (architecture §5). */
export function setMode(mode: KexMode): void {
  document.documentElement.dataset.kex = mode;
  if (mode === 'app' || mode === 'skin') {
    neutralizeThemeLinkBackground();
    // The theme sheet can still be arriving when the first mode is set.
    window.addEventListener('load', () => neutralizeThemeLinkBackground(), { once: true });
  }
}

export function getMode(): KexMode | undefined {
  return document.documentElement.dataset.kex as KexMode | undefined;
}
