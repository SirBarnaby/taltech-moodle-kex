import type { RefObject } from 'preact';
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
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
  next?.focus({ preventScroll: true });
}

/** No focus ring until the first key press: programmatic focus on arrival stays quiet. */
export function useQuietFocus(): void {
  useEffect(() => {
    const root = document.getElementById('kex-root');
    const off = (): void => root?.removeAttribute('data-quiet');
    root?.setAttribute('data-quiet', '');
    window.addEventListener('keydown', off, { once: true, capture: true });
    return () => {
      window.removeEventListener('keydown', off, true);
      off();
    };
  }, []);
}

export interface SlidingThumb {
  left: number;
  width: number;
  /** False until the lit item has been measured (the highlight stays hidden). */
  ready: boolean;
  /** False for the first placement, so the highlight appears in place and only slides on later changes. */
  anim: boolean;
}

/**
 * Where a sliding highlight (a pill or an underline) sits under the lit item of `row`, found by `selector` (null: none is lit).
 * Measured after layout, and again when the row resizes or the fonts arrive. `measure` turns the lit element into a box (default:
 * its own offset box). Re-renders only when the box really changes.
 */
export function useSlidingThumb(row: RefObject<HTMLElement>, selector: string | null, deps: readonly unknown[], measure?: (el: HTMLElement) => { left: number; width: number }): SlidingThumb {
  const [thumb, setThumb] = useState<SlidingThumb>({ left: 0, width: 0, ready: false, anim: false });
  useLayoutEffect(() => {
    let live = true;
    const place = (): void => {
      if (!live) return;
      const el = selector ? row.current?.querySelector<HTMLElement>(selector) : null;
      if (!el) return setThumb((b) => (b.ready ? { ...b, ready: false, anim: false } : b));
      const box = measure ? measure(el) : { left: el.offsetLeft, width: el.offsetWidth };
      setThumb((b) => (b.ready && b.left === box.left && b.width === box.width ? b : { ...box, ready: true, anim: b.ready }));
    };
    place();
    const ro = new ResizeObserver(place);
    if (row.current) ro.observe(row.current);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [selector, ...deps]);
  return thumb;
}
