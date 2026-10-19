import { effects, type EffectHandle } from './effects';
import type { RibbonsOptions } from './ribbons';
import { heroEffectMode } from '../state/effects';

/**
 * One ribbons canvas for every hero and the login art. Each new WebGL context compiles the shader again (about a second on a real
 * GPU), which showed as the shader popping in after the text on every course switch. The canvas is created once, as early as boot,
 * and moved into whichever hero is on screen; its compiled program and the first drawn frame travel with it.
 */
let canvas: HTMLCanvasElement | null = null;
let handle: EffectHandle | null = null;

function ensure(opts: RibbonsOptions): { canvas: HTMLCanvasElement; handle: EffectHandle } {
  if (!canvas || !handle) {
    canvas = document.createElement('canvas');
    canvas.className = 'kex-hero__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    handle = effects.register(canvas, opts, (m) => (heroEffectMode.value = m));
  }
  return { canvas, handle };
}

export const heroCanvas = {
  /** Start compiling now, with the default look; the hero that mounts sets its own seed and palette. */
  warm(): void {
    ensure({ seed: 0, intensity: 1, leftFade: 0.46 });
  },
  /** Put the canvas into `host` (first child) with this look. Returns the function that takes it out again. */
  attach(host: HTMLElement, opts: RibbonsOptions): () => void {
    const { canvas: c, handle: h } = ensure(opts);
    h.update(opts);
    host.prepend(c);
    return () => {
      if (c.parentElement === host) c.remove();
    };
  },
  setPointer(x: number, y: number): void {
    handle?.setPointer(x, y);
  },
};
