import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import { effects, type EffectMode } from '../../fx/effects';
import { followArrivalRush } from '../../fx/rush';
import type { RibbonsOptions } from '../../fx/ribbons';
import { resolvedMotion, settings } from '../../state';

/** One lifecycle per surface. Callers key the canvas to its renderer options: a disposed WebGL context cannot be reused. */
export function useRibbons(opts: RibbonsOptions, pointerRoot?: RefObject<HTMLElement>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<EffectMode>('fallback');
  const { seed, intensity, leftFade, style } = opts;
  const config = settings.value;
  const motion = resolvedMotion.value;
  useLayoutEffect(() => {
    effects.configure({ effects: config.effects, motion, freezeTime: config.debug.freezeTime });
  }, [config.effects, config.debug.freezeTime, motion]);
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const handle = effects.register(c, { seed, intensity, leftFade, style }, setMode);
    const rushing = followArrivalRush((r) => handle.setRush(r));
    const root = pointerRoot?.current;
    const move = (e: PointerEvent): void => {
      const r = c.getBoundingClientRect();
      if (r.width && r.height) handle.setPointer((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
    };
    const leave = (): void => handle.setPointer(0, 0);
    root?.addEventListener('pointermove', move, { passive: true });
    root?.addEventListener('pointerleave', leave);
    return () => {
      rushing();
      root?.removeEventListener('pointermove', move);
      root?.removeEventListener('pointerleave', leave);
      handle.dispose();
    };
  }, [seed, intensity, leftFade, style, pointerRoot]);
  return { canvas, mode };
}
