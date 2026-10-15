export type KexMode = 'boot' | 'app' | 'skin' | 'off';

/** `html[data-kex]` drives the CSS gate and which stylesheet layers apply (architecture §5). */
export function setMode(mode: KexMode): void {
  document.documentElement.dataset.kex = mode;
}

export function getMode(): KexMode | undefined {
  return document.documentElement.dataset.kex as KexMode | undefined;
}
