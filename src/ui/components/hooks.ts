import { useEffect } from 'preact/hooks';
import { effects } from '../../fx/effects';
import { resolvedMotion, settings } from '../../state';

/** Hero and band shaders follow the settings (architecture §14). Call once per view that shows a canvas. */
export function useEffectsConfig(): void {
  const eff = settings.value.effects;
  const motion = resolvedMotion.value;
  const freeze = settings.value.debug?.freezeTime;
  useEffect(() => {
    effects.configure({ effects: eff, motion, freezeTime: freeze });
  }, [eff, motion, freeze]);
}

/** Roving focus inside a list: ArrowUp/ArrowDown and j/k move between `[data-kex-item]` children of `container`. */
export function focusSibling(current: Element | null, delta: 1 | -1, selector: string): void {
  const list = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const i = list.findIndex((el) => el === current || el.contains(current));
  const next = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? (delta === 1 ? -1 : list.length) : i) + delta))];
  next?.focus();
}
